import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from emergentintegrations.llm.chat import (
    FileContentWithMimeType,
    LlmChat,
    StreamDone,
    TextDelta,
    UserMessage,
)

from lib.db import db
from lib.dates import today_iso
from models.pandi import (
    ChatHistory,
    ChatMessage,
    ChatStreamRequest,
    FileUploadResponse,
    Profile,
    ProfileUpsert,
    SourceRef,
    TodayResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pandi", tags=["pandi"])

UPLOAD_DIR = Path("/tmp/pandi_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "image/webp",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "video/mp4",
    "video/quicktime",
}


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _visual_scene_for(text: str) -> str | None:
    lowered = text.lower()
    if any(term in lowered for term in ("solar system", "planets", "planetary orbit", "saturn", "neptune")):
        return "solar-system"
    if any(term in lowered for term in ("atom", "electron", "proton", "neutron", "orbital")):
        return "atom"
    if any(term in lowered for term in ("geometry", "cube", "sphere", "polyhedron", "3d math", "3d maths")):
        return "geometry"
    if any(term in lowered for term in ("surface", "coordinate plane", "parametric", "function in 3d", "3d graph")):
        return "math-surface"
    return None


def _is_date_query(text: str) -> bool:
    lowered = text.lower()
    date_terms = ("today", "current date", "what date", "what day is it", "date today")
    freshness_terms = ("news", "weather", "price", "score", "latest", "recent", "announcement")
    return any(term in lowered for term in date_terms) and not any(term in lowered for term in freshness_terms)


def _needs_live_search(text: str) -> bool:
    lowered = text.lower()
    freshness_terms = (
        "today's news", "today news", "current news", "latest", "recent", "weather", "forecast",
        "stock price", "price of", "score", "schedule", "release", "announcement", "this week",
    )
    return any(term in lowered for term in freshness_terms)


def _sources_from_text(text: str) -> list[SourceRef]:
    urls = list(dict.fromkeys(re.findall(r"https?://[^\s)\]}>]+", text)))
    return [SourceRef(url=url.rstrip(".,")) for url in urls[:8]]


def _normalize_for_model(value: object) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


@router.get("/health")
async def pandi_health() -> dict[str, str]:
    return {"status": "online", "assistant": "PANDI AI MARK II"}


@router.get("/today", response_model=TodayResponse)
async def get_today() -> TodayResponse:
    return TodayResponse(today=today_iso(), utc_timestamp=datetime.now(timezone.utc))


@router.get("/profile/{profile_id}", response_model=Profile)
async def get_profile(profile_id: str) -> Profile:
    profile = await db.pandi_profiles.find_one({"profile_id": profile_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return Profile(**profile)


@router.put("/profile/{profile_id}", response_model=Profile)
async def upsert_profile(profile_id: str, input: ProfileUpsert) -> Profile:
    now = datetime.now(timezone.utc)
    current = await db.pandi_profiles.find_one({"profile_id": profile_id})
    profile = Profile(
        profile_id=profile_id,
        name=input.name.strip(),
        avatar_data_url=input.avatar_data_url,
        created_at=current.get("created_at", now) if current else now,
        updated_at=now,
    )
    await db.pandi_profiles.replace_one(
        {"profile_id": profile_id}, profile.model_dump(), upsert=True
    )
    return profile


@router.get("/history/{session_id}", response_model=ChatHistory)
async def get_history(session_id: str) -> ChatHistory:
    rows = await db.pandi_messages.find({"session_id": session_id}).sort("created_at", 1).to_list(200)
    return ChatHistory(session_id=session_id, messages=[ChatMessage(**row) for row in rows])


@router.post("/files", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)) -> FileUploadResponse:
    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="This file type is not supported for analysis.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Files must be 25 MB or smaller.")

    file_id = str(uuid.uuid4())
    suffix = Path(file.filename or "upload.bin").suffix[:12]
    path = UPLOAD_DIR / f"{file_id}{suffix}"
    path.write_bytes(content)
    await db.pandi_files.insert_one(
        {
            "file_id": file_id,
            "filename": file.filename or "uploaded-file",
            "mime_type": mime_type,
            "size": len(content),
            "path": str(path),
            "created_at": datetime.now(timezone.utc),
        }
    )
    return FileUploadResponse(
        file_id=file_id,
        filename=file.filename or "uploaded-file",
        mime_type=mime_type,
        size=len(content),
    )


async def _stream_chat(request: ChatStreamRequest, file_rows: list[dict]) -> AsyncIterator[str]:
    should_search = request.use_live_search and _needs_live_search(request.message)
    user_message = ChatMessage(
        session_id=request.session_id,
        role="user",
        content=request.message,
        live_search=should_search,
    )
    await db.pandi_messages.insert_one(user_message.model_dump())

    previous = await db.pandi_messages.find({"session_id": request.session_id}).sort("created_at", -1).to_list(14)
    previous.reverse()
    context_lines = [
        f"{row.get('role', 'user').upper()}: {row.get('content', '')}" for row in previous[:-1]
    ]
    context = "\n".join(context_lines[-12:]) or "No earlier turns."
    visual_scene = _visual_scene_for(request.message)
    today = today_iso()

    yield _sse(
        "meta",
        {
            "message_id": user_message.id,
            "today": today,
            "visual_scene": visual_scene,
            "live_search": should_search,
        },
    )

    if _is_date_query(request.message):
        answer = f"Today is {today} (UTC)."
        assistant_message = ChatMessage(
            session_id=request.session_id,
            role="assistant",
            content=answer,
            live_search=False,
            visual_scene=visual_scene,
        )
        await db.pandi_messages.insert_one(assistant_message.model_dump())
        yield _sse("delta", {"text": answer})
        yield _sse("done", {"message_id": assistant_message.id, "content": answer, "sources": [], "visual_scene": visual_scene})
        return

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        yield _sse("error", {"message": "Live AI is not configured. Text mode remains available after setup."})
        return

    system_message = f"""You are PANDI AI MARK II (Personalized Advanced Neural Digital Intelligence), created by VIGNASHWAR S.
You are a precise, warm, educational assistant. The current UTC date is {today}; never invent a current date.
The user language preference is {request.language}. Auto-detect the user's language and reply in that same language unless they ask otherwise.
When live web search is enabled, use it for current or time-sensitive claims. Prefer reliable sources, mention publication timing when available, and include source URLs in the response. Never fabricate live information.
When explaining science or mathematics, be honest about educationally adjusted scales and make clear when a model is conceptual.
If a topic benefits from a visual explanation, describe which visual scene would help; the client may open the PANDI 3D Explainer Engine.
Keep answers clear and useful. Do not claim to have analyzed a file unless the attached file was actually available to you.

Recent conversation context:
{context}
"""

    try:
        chat = (
            LlmChat(api_key=api_key, session_id=f"pandi-{request.session_id}", system_message=system_message)
            .with_model("gemini", "gemini-3.1-pro-preview")
        )
        if should_search:
            chat = chat.with_tools([{"googleSearch": {}}])

        attachments = [
            FileContentWithMimeType(file_path=row["path"], mime_type=row["mime_type"])
            for row in file_rows
            if Path(row["path"]).exists()
        ]
        prompt = request.message
        if should_search:
            prompt += "\nUse live search when this question needs current information, and cite source URLs in your answer."
        llm_message = UserMessage(text=prompt, file_contents=attachments or None)
        parts: list[str] = []

        async for event in chat.stream_message(llm_message):
            if isinstance(event, TextDelta) and event.content:
                parts.append(event.content)
                yield _sse("delta", {"text": event.content})
            elif isinstance(event, StreamDone):
                if event.content and not parts:
                    parts.append(event.content)
                    yield _sse("delta", {"text": event.content})

        answer = "".join(parts).strip()
        if not answer:
            yield _sse("error", {"message": "PANDI could not produce a response. Please try again."})
            return

        sources = _sources_from_text(answer)
        assistant_message = ChatMessage(
            session_id=request.session_id,
            role="assistant",
            content=answer,
            live_search=should_search,
            sources=sources,
            visual_scene=visual_scene,
        )
        await db.pandi_messages.insert_one(assistant_message.model_dump())
        yield _sse(
            "done",
            {
                "message_id": assistant_message.id,
                "content": answer,
                "sources": [source.model_dump() for source in sources],
                "visual_scene": visual_scene,
            },
        )
    except Exception:
        logger.exception("PANDI chat stream failed")
        yield _sse(
            "error",
            {"message": "Live AI or web search is temporarily unavailable. Your text can still be retried."},
        )


@router.post("/chat/stream")
async def stream_chat(request: ChatStreamRequest) -> StreamingResponse:
    if request.file_ids:
        file_rows = await db.pandi_files.find({"file_id": {"$in": request.file_ids}}).to_list(8)
        if len(file_rows) != len(set(request.file_ids)):
            raise HTTPException(status_code=404, detail="One or more uploaded files could not be found.")
    else:
        file_rows = []
    return StreamingResponse(
        _stream_chat(request, file_rows),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )