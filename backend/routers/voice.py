"""PANDI voice: Fish Audio (custom cloned voice) → ElevenLabs clone of my-voice.mp3 → browser speech, in that order."""

import logging
import os
import re
import uuid
from pathlib import Path
from typing import AsyncIterator

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from lib.db import db
from models.pandi import TranscribeResponse, TTSRequest, VoiceStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

ENV_PATH = Path(__file__).parent.parent / ".env"
SAMPLE_PATH = Path(__file__).parent.parent.parent / "frontend" / "public" / "assets" / "my-voice.mp3"
UPLOAD_DIR = Path("/tmp/pandi_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SETTINGS_KEY = "voice"
FISH_VOICE_ID = "06d391f12711442981bf4d25a9aa497b"
FISH_TTS_URL = "https://api.fish.audio/v1/tts"


def _api_key() -> str:
    return os.environ.get("ELEVENLABS_API_KEY", "").strip()


def _client():
    from elevenlabs.client import AsyncElevenLabs

    return AsyncElevenLabs(api_key=_api_key(), timeout=30.0)


def _persist_env(key: str, value: str) -> None:
    """Store the voice id in backend/.env (as requested) and in the live process env."""
    os.environ[key] = value
    try:
        text = ENV_PATH.read_text() if ENV_PATH.exists() else ""
        if re.search(rf"^{key}=.*$", text, flags=re.M):
            text = re.sub(rf"^{key}=.*$", f"{key}={value}", text, flags=re.M)
        else:
            text = text.rstrip("\n") + f"\n{key}={value}\n"
        ENV_PATH.write_text(text)
    except OSError:
        logger.warning("Could not write %s to .env", key)


async def _settings() -> dict:
    return await db.pandi_settings.find_one({"key": SETTINGS_KEY}) or {}


async def _save_settings(**fields) -> None:
    await db.pandi_settings.update_one({"key": SETTINGS_KEY}, {"$set": fields}, upsert=True)


async def resolve_voice() -> tuple[str | None, bool, str]:
    """Return (voice_id, cloned, detail). Clones the official sample on first use."""
    if not _api_key():
        return None, False, "ELEVENLABS_API_KEY is not set; using browser speech synthesis."

    env_voice = os.environ.get("ELEVENLABS_VOICE_ID", "").strip()
    saved = await _settings()
    if env_voice:
        return env_voice, bool(saved.get("cloned", True)), "Official cloned PANDI voice ready."
    if saved.get("voice_id"):
        return saved["voice_id"], bool(saved.get("cloned")), saved.get("detail", "Voice ready.")

    client = _client()
    try:
        if not SAMPLE_PATH.exists():
            raise FileNotFoundError("my-voice.mp3 sample is missing")
        with SAMPLE_PATH.open("rb") as sample:
            voice = await client.voices.ivc.create(name="PANDI Official Voice", files=[sample])
        voice_id = voice.voice_id
        detail = "Official voice cloned from my-voice.mp3."
        _persist_env("ELEVENLABS_VOICE_ID", voice_id)
        await _save_settings(voice_id=voice_id, cloned=True, detail=detail)
        return voice_id, True, detail
    except Exception as exc:  # cloning not on plan / sample issue → closest stock voice + warning
        logger.warning("Voice cloning failed: %s", exc)
        try:
            voices = await client.voices.get_all()
            if not voices.voices:
                raise RuntimeError("no voices available")
            fallback = voices.voices[0]
            detail = f"Voice cloning unavailable ({str(exc)[:80]}). Using stock voice '{fallback.name}'."
            await _save_settings(voice_id=fallback.voice_id, cloned=False, detail=detail)
            return fallback.voice_id, False, detail
        except Exception as inner:
            logger.warning("Voice fallback failed: %s", inner)
            return None, False, f"ElevenLabs unavailable: {str(inner)[:120]}"


def _fish_api_key() -> str:
    return os.environ.get("FISH_AUDIO_API_KEY", "").strip()


async def _fish_audio_response(text: str) -> httpx.Response:
    headers = {"Authorization": f"Bearer {_fish_api_key()}", "Content-Type": "application/json", "model": "s2.1-pro"}
    payload = {"text": text, "reference_id": FISH_VOICE_ID, "format": "mp3"}
    client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    req = client.build_request("POST", FISH_TTS_URL, headers=headers, json=payload)
    response = await client.send(req, stream=True)
    response._pandi_client = client  # type: ignore[attr-defined]
    return response


async def _fish_audio_bytes(response: httpx.Response) -> AsyncIterator[bytes]:
    try:
        async for chunk in response.aiter_bytes():
            if chunk:
                yield chunk
    finally:
        await response.aclose()
        await response._pandi_client.aclose()  # type: ignore[attr-defined]


@router.get("/status", response_model=VoiceStatus)
async def voice_status() -> VoiceStatus:
    if _fish_api_key():
        return VoiceStatus(configured=True, provider="fish_audio", voice_id=FISH_VOICE_ID, cloned=True, detail="PANDI's official Fish Audio voice is ready.")
    voice_id, cloned, detail = await resolve_voice()
    return VoiceStatus(
        configured=voice_id is not None,
        provider="elevenlabs" if voice_id else "browser",
        voice_id=voice_id,
        cloned=cloned,
        detail=detail,
    )


@router.post("/reset")
async def voice_reset() -> dict[str, str]:
    """Forget the resolved voice so the next request re-clones (e.g. after adding a key)."""
    await db.pandi_settings.delete_one({"key": SETTINGS_KEY})
    return {"status": "reset"}


async def _audio_stream(voice_id: str, text: str) -> AsyncIterator[bytes]:
    client = _client()
    async for chunk in client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    ):
        if chunk:
            yield chunk


@router.post("/tts")
async def text_to_speech(request: TTSRequest) -> StreamingResponse:
    if _fish_api_key():
        try:
            response = await _fish_audio_response(request.text)
            if response.status_code >= 400:
                logger.warning("Fish Audio TTS failed (%s); falling back to ElevenLabs/browser.", response.status_code)
                await response.aclose()
                await response._pandi_client.aclose()  # type: ignore[attr-defined]
            else:
                return StreamingResponse(_fish_audio_bytes(response), media_type="audio/mpeg")
        except Exception:
            logger.exception("Fish Audio TTS failed; falling back to ElevenLabs/browser")
    voice_id, _cloned, detail = await resolve_voice()
    if not voice_id:
        raise HTTPException(status_code=503, detail=detail)
    try:
        return StreamingResponse(_audio_stream(voice_id, request.text), media_type="audio/mpeg")
    except Exception as exc:
        logger.exception("TTS failed")
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {exc}") from exc


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile = File(...)) -> TranscribeResponse:
    """Fallback speech-to-text (Whisper via the Emergent universal key) for browsers without SpeechRecognition."""
    api_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Voice transcription is not configured. Please type your message instead.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="No audio was recorded.")

    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    tmp_path = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
    tmp_path.write_bytes(content)
    try:
        from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText

        stt = OpenAISpeechToText(api_key=api_key)
        result = await stt.transcribe(str(tmp_path), model="whisper-1")
        text = getattr(result, "text", None)
        if text is None and isinstance(result, dict):
            text = result.get("text")
        return TranscribeResponse(text=(text or "").strip())
    except Exception as exc:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=502, detail="PANDI could not transcribe that audio. Please try again or type instead.") from exc
    finally:
        tmp_path.unlink(missing_ok=True)
