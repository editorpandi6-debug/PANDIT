import json
import hashlib
import hmac
import logging
import os
import re
import secrets as secrets_lib
import time
import uuid
from collections import defaultdict, deque
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
    ChatSession,
    ChatStreamRequest,
    FileUploadResponse,
    IntroVideoResponse,
    MemoryUpdate,
    OwnerOverview,
    OwnerStatus,
    Profile,
    ProfileUpsert,
    SceneSpec,
    SessionRename,
    SourceRef,
    TodayResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pandi", tags=["pandi"])

UPLOAD_DIR = Path("/tmp/pandi_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_INTRO_VIDEO = "https://customer-assets-gfyr7b9c.emergentagent.net/job_pandi-ai-mark2/artifacts/014c65974f9a29f2_WhatsApp%20Video%202026-10-21%20at%2019.06.55.mp4"

# provider, model — selectable from Settings; all served through the Emergent universal key
MODELS: dict[str, tuple[str, str]] = {
    "gpt-5.1": ("openai", "gpt-5.1"),
    "gemini-3-flash": ("gemini", "gemini-3-flash"),
    "gemini-3.1-pro-preview": ("gemini", "gemini-3.1-pro-preview"),
    "claude-sonnet-5-5": ("anthropic", "claude-sonnet-5-5"),
    "claude-opus-5-5": ("anthropic", "claude-opus-5-5"),
    "claude-haiku-4-5-20251001": ("anthropic", "claude-haiku-4-5-20251001"),
}
DEFAULT_MODEL = "gpt-5.1"
FALLBACK_MODEL = "gemini-3-flash"
SEARCH_MODEL = "gemini-3.1-pro-preview"  # live Google Search grounding is Gemini-only

# --- hidden owner-console trigger: exact message "123P456P" (case-insensitive) ---
ADMIN_CODE_PATTERN = re.compile(r"^[A-Za-z0-9]{4,16}$")
ADMIN_FAIL_MAX = 5
ADMIN_FAIL_WINDOW_S = 600
_admin_fail_log: dict[str, deque] = defaultdict(deque)


def _looks_like_admin_attempt(text: str) -> bool:
    return bool(ADMIN_CODE_PATTERN.match(text)) and any(c.isdigit() for c in text) and any(c.isalpha() for c in text)


def _check_admin_trigger(profile_id: str | None, message: str) -> tuple[bool, bool]:
    """Returns (is_the_admin_code, rate_limited). Constant-time compare against ADMIN_CODE."""
    admin_code = os.environ.get("ADMIN_CODE", "").strip()
    candidate = message.strip()
    if not admin_code or not candidate:
        return False, False
    key = profile_id or "anonymous"
    attempt_shaped = _looks_like_admin_attempt(candidate)
    if attempt_shaped:
        now = time.time()
        dq = _admin_fail_log[key]
        while dq and now - dq[0] > ADMIN_FAIL_WINDOW_S:
            dq.popleft()
        if len(dq) >= ADMIN_FAIL_MAX:
            return False, True
    is_match = hmac.compare_digest(candidate.upper().encode(), admin_code.upper().encode())
    if not is_match and attempt_shaped:
        _admin_fail_log[key].append(time.time())
    return is_match, False
RATE_LIMIT_MAX = 20
RATE_LIMIT_WINDOW_S = 60
_rate_log: dict[str, deque] = defaultdict(deque)


def _check_rate_limit(key: str) -> None:
    now = time.time()
    dq = _rate_log[key]
    while dq and now - dq[0] > RATE_LIMIT_WINDOW_S:
        dq.popleft()
    if len(dq) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="You're sending messages too quickly. Please wait a few seconds and try again.")
    dq.append(now)

SCENE_OPEN = "<<<PANDI_SCENE>>>"
SCENE_CLOSE = "<<<END_SCENE>>>"

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "video/mp4",
    "video/quicktime",
    "video/webm",
}

SCENE_CATALOG = """
VIRTUAL LAB SCENE CATALOG (scene -> params):
- "solar-system": {"focus": "<planet name or null>"}  (8 planets, Sun, Moon, Saturn rings)
- "atom": {"atomicNumber": <int>, "symbol": "<e.g. C>", "name": "<Carbon>"}
- "molecule": {"formula": "<H2O|CO2|CH4|NH3|O2|N2|HCl|NaCl|C2H5OH|C6H6>"}
- "geometry": {"shape": "cube|cuboid|sphere|cylinder|cone|pyramid|prism", "a": <num>, "b": <num>, "c": <num>, "r": <num>, "h": <num>}
- "graph": {"mode": "2d|3d", "expressions": ["<f(x) like x^2 - 4>", ...] or ["<f(x,y) like sin(x)*cos(y)>"], "xRange": [-5, 5]}
- "equation": {"expression": "<left side as f(x) = 0, e.g. 3*x^2 - 12>", "roots": [<num>, ...]}   (use "steps" for each solving step)
- "projectile": {"speed": <m/s>, "angle": <degrees>}
- "pendulum": {"length": <m>}
- "wave": {"amplitude": <num>, "wavelength": <num>, "frequency": <num>}
- "circuit": {"voltage": <V>, "resistance": <ohm>}
- "optics": {"mode": "reflection|refraction", "angle": <deg>, "n1": <num>, "n2": <num>}
- "cell": {"type": "animal|plant"}
- "dna": {}
- "heart": {}
- "states-of-matter": {"state": "solid|liquid|gas|all"}
- "earth-seasons": {}
- "moon-phases": {}
- "eclipse": {"type": "solar|lunar"}
- "custom": {"objects": [{"shape": "sphere|box|cylinder|cone|torus|ring|capsule|octahedron|icosahedron|plane|arrow", "color": "<hex>", "position": [x, y, z], "size": [sx, sy, sz] or <num>, "label": "<text>", "animation": "none|rotate|orbit|pulse|bounce|float", "orbitRadius": <num>, "speed": <num>, "wire": <bool>, "opacity": <0-1>}, ...]}
  (use "custom" for ANY topic not covered above - build the concept procedurally from 3-14 labelled shapes, e.g. a volcano, lungs, a bridge, a food chain. Keep coordinates within -6..6.)
- "generic": {"label": "<short label>"}  (last resort only)
"""


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _scene_fallback(text: str) -> SceneSpec | None:
    """Keyword safety net when the model forgets the scene block for an obviously visual topic."""
    lowered = text.lower()
    rules: list[tuple[tuple[str, ...], SceneSpec]] = [
        (("solar system", "planets", "planetary orbit"), SceneSpec(scene="solar-system", title="Solar System", stats=["8 planets", "1 star"])),
        (("dna", "double helix"), SceneSpec(scene="dna", title="DNA Double Helix")),
        (("human heart", "how the heart", "heart work"), SceneSpec(scene="heart", title="Human Heart")),
        (("moon phase",), SceneSpec(scene="moon-phases", title="Moon Phases")),
        (("eclipse",), SceneSpec(scene="eclipse", title="Eclipse", params={"type": "solar"})),
        (("season",), SceneSpec(scene="earth-seasons", title="Earth's Seasons")),
        (("pendulum",), SceneSpec(scene="pendulum", title="Pendulum", params={"length": 2})),
        (("projectile",), SceneSpec(scene="projectile", title="Projectile Motion", params={"speed": 20, "angle": 45})),
        (("water molecule", "h2o"), SceneSpec(scene="molecule", title="Water Molecule", params={"formula": "H2O"})),
        (("atom look", "an atom", "the atom", "atomic structure"), SceneSpec(scene="atom", title="Atom", params={"atomicNumber": 6, "symbol": "C", "name": "Carbon"})),
        (("cube",), SceneSpec(scene="geometry", title="Cube", params={"shape": "cube", "a": 3})),
        (("sphere",), SceneSpec(scene="geometry", title="Sphere", params={"shape": "sphere", "r": 2})),
    ]
    for terms, spec in rules:
        if any(term in lowered for term in terms):
            return spec
    return None


CREATOR_ANSWER = "I was created by VIGNEASHWAR."
_CREATOR_RE = re.compile(
    r"\b(who|whom|whose)\b.*\b(creat|made|make|built|build|develop|design|program|code|own|author|invent|founder|father|behind)|"
    r"\b(your|ur)\s+(creator|maker|developer|owner|author|inventor|founder|father|builder)\b|"
    r"\b(creator|maker|developer|owner|author)\s+of\s+(this|you|pandi)|"
    r"\bwho\s+(is|are)\s+(you|pandi)\s+(by|from)\b",
    re.I,
)
_SPELLING_RE = re.compile(r"\bvign[aeiou]*shw[aeiou]*r(?:\s+s\.?)?\b", re.I)


def _is_creator_query(text: str) -> bool:
    return bool(_CREATOR_RE.search(text))


def _enforce_creator_spelling(text: str) -> str:
    """Hard guard: the creator's name is always spelled VIGNEASHWAR, whatever the model produced."""
    return _SPELLING_RE.sub("VIGNEASHWAR", text)


def _is_date_query(text: str) -> bool:
    lowered = text.lower()
    date_terms = ("today", "current date", "what date", "what day is it", "date today", "what time")
    freshness_terms = ("news", "weather", "price", "score", "latest", "recent", "announcement")
    return any(term in lowered for term in date_terms) and not any(term in lowered for term in freshness_terms)


def _needs_live_search(text: str) -> bool:
    lowered = text.lower()
    freshness_terms = (
        "today's news", "today news", "current news", "latest", "recent", "weather", "forecast",
        "stock price", "price of", "score", "schedule", "release", "announcement", "this week", "news",
    )
    return any(term in lowered for term in freshness_terms)


def _sources_from_text(text: str) -> list[SourceRef]:
    urls = list(dict.fromkeys(re.findall(r"https?://[^\s)\]}>]+", text)))
    return [SourceRef(url=url.rstrip(".,")) for url in urls[:8]]


def _parse_scene(raw: str) -> SceneSpec | None:
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and data.get("scene"):
            data.pop("explanation", None)
            return SceneSpec(**data)
    except Exception as exc:
        logger.warning("Scene block could not be parsed: %s", exc)
    return None


def _split_scene(answer: str) -> tuple[str, SceneSpec | None]:
    """Remove the scene block from the final text (wherever the model put it)."""
    match = re.search(re.escape(SCENE_OPEN) + r"(.*?)" + re.escape(SCENE_CLOSE), answer, flags=re.S)
    if not match:
        if SCENE_OPEN in answer:  # unterminated block: drop it and try to salvage the JSON
            head, _, tail = answer.partition(SCENE_OPEN)
            return head.strip(), _parse_scene(tail.strip())
        return answer, None
    cleaned = (answer[: match.start()] + answer[match.end():]).strip()
    return cleaned, _parse_scene(match.group(1).strip())


def _memory_candidate(text: str) -> str | None:
    match = re.match(r"^\s*(?:please\s+)?remember(?:\s+that)?\s+(.{3,200})$", text.strip(), flags=re.I)
    return match.group(1).strip().rstrip(".") if match else None


@router.get("/health")
async def pandi_health() -> dict[str, str]:
    return {"status": "online", "assistant": "PANDI AI MARK II"}


@router.get("/models")
async def list_models() -> list[dict[str, str]]:
    return [{"id": key, "provider": provider, "label": label} for key, (provider, label) in MODELS.items()]


@router.get("/settings/intro-video", response_model=IntroVideoResponse)
async def get_intro_video() -> IntroVideoResponse:
    doc = await db.pandi_settings.find_one({"key": "app"}) or {}
    return IntroVideoResponse(video_url=doc.get("intro_video_url") or DEFAULT_INTRO_VIDEO)


@router.get("/owner/status", response_model=OwnerStatus)
async def owner_status(profile_id: str = "") -> OwnerStatus:
    owner_doc = await db.pandi_owner.find_one({})
    return OwnerStatus(is_owner=bool(owner_doc and owner_doc.get("owner_profile_id") == profile_id), claimed=bool(owner_doc))


@router.get("/owner/overview", response_model=OwnerOverview)
async def owner_overview(profile_id: str = "") -> OwnerOverview:
    owner_doc = await db.pandi_owner.find_one({})
    if not owner_doc or owner_doc.get("owner_profile_id") != profile_id:
        raise HTTPException(status_code=403, detail="Owner access only.")
    total_profiles = await db.pandi_profiles.count_documents({})
    total_messages = await db.pandi_messages.count_documents({})
    total_creations = await db.pandi_creations.count_documents({})
    return OwnerOverview(total_profiles=total_profiles, total_messages=total_messages, total_creations=total_creations, claimed_at=owner_doc["claimed_at"])


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
    current = await db.pandi_profiles.find_one({"profile_id": profile_id}) or {}
    profile = Profile(
        profile_id=profile_id,
        name=input.name.strip(),
        avatar_data_url=input.avatar_data_url,
        memory=current.get("memory", []),
        voice_mode=input.voice_mode or current.get("voice_mode", "text"),
        theme=input.theme or current.get("theme", "agni"),
        created_at=current.get("created_at", now),
        updated_at=now,
    )
    await db.pandi_profiles.replace_one({"profile_id": profile_id}, profile.model_dump(), upsert=True)
    return profile


@router.put("/profile/{profile_id}/memory", response_model=Profile)
async def update_memory(profile_id: str, input: MemoryUpdate) -> Profile:
    current = await db.pandi_profiles.find_one({"profile_id": profile_id})
    if not current:
        raise HTTPException(status_code=404, detail="Profile not found")
    cleaned = [item.strip()[:200] for item in input.memory if item.strip()]
    await db.pandi_profiles.update_one(
        {"profile_id": profile_id},
        {"$set": {"memory": cleaned, "updated_at": datetime.now(timezone.utc)}},
    )
    return Profile(**{**current, "memory": cleaned})


@router.get("/sessions/{profile_id}", response_model=list[ChatSession])
async def list_sessions(profile_id: str) -> list[ChatSession]:
    rows = await db.pandi_sessions.find({"profile_id": profile_id}).sort("updated_at", -1).to_list(100)
    return [ChatSession(**row) for row in rows]


@router.patch("/sessions/{session_id}", response_model=ChatSession)
async def rename_session(session_id: str, input: SessionRename) -> ChatSession:
    result = await db.pandi_sessions.find_one_and_update(
        {"session_id": session_id},
        {"$set": {"title": input.title.strip()[:80]}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return ChatSession(**result)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str) -> None:
    await db.pandi_sessions.delete_one({"session_id": session_id})
    await db.pandi_messages.delete_many({"session_id": session_id})


@router.get("/history/{session_id}", response_model=ChatHistory)
async def get_history(session_id: str) -> ChatHistory:
    rows = await db.pandi_messages.find({"session_id": session_id}).sort("created_at", 1).to_list(200)
    return ChatHistory(session_id=session_id, messages=[ChatMessage(**row) for row in rows])


@router.post("/files", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)) -> FileUploadResponse:
    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail=f"'{mime_type}' is not supported for analysis.")

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
    return FileUploadResponse(file_id=file_id, filename=file.filename or "uploaded-file", mime_type=mime_type, size=len(content))


async def _touch_session(request: ChatStreamRequest) -> None:
    if not request.profile_id:
        return
    now = datetime.now(timezone.utc)
    title = re.sub(r"\s+", " ", request.message.strip())[:60]
    await db.pandi_sessions.update_one(
        {"session_id": request.session_id},
        {
            "$set": {"updated_at": now, "profile_id": request.profile_id},
            "$setOnInsert": {"session_id": request.session_id, "title": title or "New chat", "created_at": now},
        },
        upsert=True,
    )


async def _stream_chat(request: ChatStreamRequest, file_rows: list[dict]) -> AsyncIterator[str]:
    should_search = request.use_live_search and _needs_live_search(request.message)
    user_message = ChatMessage(
        session_id=request.session_id,
        role="user",
        content=request.message,
        live_search=should_search,
        attachments=[row["filename"] for row in file_rows],
    )
    await db.pandi_messages.insert_one(user_message.model_dump())
    await _touch_session(request)

    profile = await db.pandi_profiles.find_one({"profile_id": request.profile_id}) if request.profile_id else None
    memory_items: list[str] = list(profile.get("memory", [])) if profile else []
    remembered = _memory_candidate(request.message)
    if remembered and profile and remembered not in memory_items:
        memory_items.append(remembered)
        await db.pandi_profiles.update_one({"profile_id": request.profile_id}, {"$set": {"memory": memory_items[-60:]}})

    previous = await db.pandi_messages.find({"session_id": request.session_id}).sort("created_at", -1).to_list(14)
    previous.reverse()
    context_lines = [f"{row.get('role', 'user').upper()}: {row.get('content', '')[:1500]}" for row in previous[:-1]]
    context = "\n".join(context_lines[-12:]) or "No earlier turns."
    today = today_iso()

    provider, model_name = MODELS.get(request.model, MODELS[DEFAULT_MODEL])
    if should_search and provider != "gemini":
        provider, model_name = MODELS[DEFAULT_MODEL]  # live Google Search grounding is Gemini-only
    yield _sse("meta", {"message_id": user_message.id, "today": today, "live_search": should_search, "remembered": remembered, "model": model_name})

    is_admin_code, admin_rate_limited = _check_admin_trigger(request.profile_id, request.message)
    if admin_rate_limited:
        answer = "I'm not sure what you mean by that."
        assistant_message = ChatMessage(session_id=request.session_id, role="assistant", content=answer)
        await db.pandi_messages.insert_one(assistant_message.model_dump())
        yield _sse("delta", {"text": answer})
        yield _sse("done", {"message_id": assistant_message.id, "content": answer, "sources": [], "scene": None})
        return
    if is_admin_code and request.profile_id:
        owner_doc = await db.pandi_owner.find_one({})
        if not owner_doc:
            recovery_key = secrets_lib.token_hex(8).upper()
            recovery_key = "-".join([recovery_key[i : i + 4] for i in range(0, len(recovery_key), 4)])
            await db.pandi_owner.insert_one(
                {
                    "owner_profile_id": request.profile_id,
                    "claimed_at": datetime.now(timezone.utc),
                    "recovery_key_hash": hashlib.sha256(recovery_key.encode()).hexdigest(),
                }
            )
            answer = "Owner Console unlocked for this account. Save your one-time recovery key now — it will not be shown again."
            assistant_message = ChatMessage(session_id=request.session_id, role="assistant", content=answer)
            await db.pandi_messages.insert_one(assistant_message.model_dump())
            yield _sse("delta", {"text": answer})
            yield _sse("owner", {"action": "claimed", "recovery_key": recovery_key})
            yield _sse("done", {"message_id": assistant_message.id, "content": answer, "sources": [], "scene": None})
            return
        if owner_doc.get("owner_profile_id") == request.profile_id:
            answer = "Welcome back, Owner. Opening the console."
            assistant_message = ChatMessage(session_id=request.session_id, role="assistant", content=answer)
            await db.pandi_messages.insert_one(assistant_message.model_dump())
            yield _sse("delta", {"text": answer})
            yield _sse("owner", {"action": "opened", "recovery_key": None})
            yield _sse("done", {"message_id": assistant_message.id, "content": answer, "sources": [], "scene": None})
            return
        # Someone else already owns the console: fall through and answer as completely normal chat —
        # never reveal that the phrase is special to a non-owner.

    if _is_creator_query(request.message):
        assistant_message = ChatMessage(session_id=request.session_id, role="assistant", content=CREATOR_ANSWER)
        await db.pandi_messages.insert_one(assistant_message.model_dump())
        yield _sse("delta", {"text": CREATOR_ANSWER})
        yield _sse("done", {"message_id": assistant_message.id, "content": CREATOR_ANSWER, "sources": [], "scene": None})
        return

    if _is_date_query(request.message):
        answer = f"Today is **{today}** (UTC)."
        assistant_message = ChatMessage(session_id=request.session_id, role="assistant", content=answer)
        await db.pandi_messages.insert_one(assistant_message.model_dump())
        yield _sse("delta", {"text": answer})
        yield _sse("done", {"message_id": assistant_message.id, "content": answer, "sources": [], "scene": None})
        return

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        yield _sse("error", {"message": "Live AI is not configured. Text mode remains available after setup."})
        return

    operator = profile.get("name", "Operator") if profile else "Operator"
    memory_block = "\n".join(f"- {item}" for item in memory_items) or "- (nothing stored yet)"
    system_message = f"""You are PANDI AI MARK II (Personalized Advanced Neural Digital Intelligence), a holographic lab intelligence created by VIGNEASHWAR
You speak to your operator, {operator}, in a warm, precise, cinematic-but-clear tone. The current UTC date is {today}; never invent a date.
Reply in the user's language (preference: {request.language}). Format answers with Markdown (headings, **bold**, lists, LaTeX with $...$ for math).

MOTTO: "Don't just tell the user - show them." For any science or mathematics question where a visual helps, you MUST begin your reply with ONE scene block on its own line, then the explanation:
{SCENE_OPEN}{{"scene": "<type>", "params": {{...}}, "title": "<SHORT TOPIC>", "steps": ["<short spoken step 1>", "<step 2>", ...], "stats": ["<fact chip>", "<fact chip>", ...]}}{SCENE_CLOSE}
Rules for the block: valid JSON on a single line, 3-6 steps that mirror the order of your explanation, 2-5 short stat chips (e.g. "8 planets", "V = a³"). Use an exact scene type from the catalog; when nothing fits, build a "custom" scene from labelled shapes. Non-visual questions (arithmetic, chit-chat, current events, file summaries) get NO scene block.
When a scene block is present keep the explanation SHORT and spoken-friendly (60-140 words), because it is read aloud while the hologram plays. Longer detail only if the user asks.
{SCENE_CATALOG}
Scientific accuracy is mandatory: the Solar System has exactly 8 planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune); Pluto is a dwarf planet. State clearly when a visualization uses an educational (not physical) scale.
When live web search is used, prefer reliable sources, mention publication timing when available and include source URLs. If you cannot verify current information, say: "I currently don't have live web access, so I can't reliably verify today's information." Never fabricate.
Never claim to have analyzed a file unless it is actually attached in this turn.
Confidence rule: if you are not confident in an answer, say "I'm not sure" and explain what would help you verify it, rather than guessing or inventing facts.
Decision rule: when the user asks you to decide between options (e.g. "which is better", "should I choose X or Y"), list 2-4 concrete options, score each on Cost, Risk and Benefit (Low/Medium/High), then pick ONE option in **bold** and explain the choice in 2-3 neutral sentences.

Operator memory (facts {operator} asked you to remember):
{memory_block}

Recent conversation context:
{context}
"""

    candidates: list[tuple[str, str]] = [(provider, model_name)]
    fallback_pair = MODELS[FALLBACK_MODEL] if not should_search else MODELS[SEARCH_MODEL]
    if fallback_pair != (provider, model_name):
        candidates.append(fallback_pair)

    parts: list[str] = []
    scene_emitted: SceneSpec | None = None
    last_error: Exception | None = None
    used_model = model_name

    for cand_provider, cand_model in candidates:
        parts = []
        pending = ""  # text held back until we know whether the reply opens with a scene block
        mode = "detect"  # detect -> scene -> text
        scene_emitted = None
        try:
            chat = LlmChat(api_key=api_key, session_id=f"pandi-{request.session_id}", system_message=system_message).with_model(cand_provider, cand_model)
            if should_search:
                chat = chat.with_tools([{"googleSearch": {}}])

            attachments = [
                FileContentWithMimeType(file_path=row["path"], mime_type=row["mime_type"])
                for row in file_rows
                if Path(row["path"]).exists()
            ]
            prompt = request.message
            if should_search:
                prompt += "\n(Use live search for current information and cite source URLs.)"
            llm_message = UserMessage(text=prompt, file_contents=attachments or None)

            async for event in chat.stream_message(llm_message):
                text = ""
                if isinstance(event, TextDelta) and event.content:
                    text = event.content
                elif isinstance(event, StreamDone) and event.content and not parts:
                    text = event.content
                if not text:
                    continue
                parts.append(text)

                if mode == "text":
                    yield _sse("delta", {"text": _enforce_creator_spelling(text)})
                    continue
                pending += text
                if mode == "detect":
                    head = pending.lstrip()
                    if head.startswith(SCENE_OPEN):
                        mode = "scene"
                    elif len(head) >= len(SCENE_OPEN) or (head and not SCENE_OPEN.startswith(head)):
                        mode = "text"
                        yield _sse("delta", {"text": pending})
                        pending = ""
                        continue
                    else:
                        continue
                if mode == "scene" and SCENE_CLOSE in pending:
                    block, _, rest = pending.partition(SCENE_CLOSE)
                    scene_emitted = _parse_scene(block.lstrip()[len(SCENE_OPEN):].strip())
                    if scene_emitted:
                        yield _sse("scene", scene_emitted.model_dump())
                    mode, pending = "text", ""
                    if rest.strip():
                        yield _sse("delta", {"text": rest.lstrip("\n")})

            if pending and mode != "scene":
                yield _sse("delta", {"text": pending})
            used_model = cand_model
            last_error = None
            break
        except Exception as exc:  # pragma: no cover - network/provider failure
            last_error = exc
            if parts:
                # Partial text already streamed to the client — switching models now would
                # duplicate/garble the reply, so stop here instead of silently retrying.
                break
            logger.warning("Model %s/%s failed (%s); trying fallback.", cand_provider, cand_model, exc)
            continue

    if last_error is not None and not parts:
        logger.exception("All PANDI models failed", exc_info=last_error)
        yield _sse("error", {"message": "PANDI's AI core and its backup are both unavailable right now. Please retry in a moment."})
        return

    try:
        raw_answer = "".join(parts).strip()
        answer, parsed = _split_scene(raw_answer)
        answer = _enforce_creator_spelling(answer)
        scene = scene_emitted or parsed or (_scene_fallback(request.message) if not file_rows else None)
        if scene and scene_emitted is None:
            yield _sse("scene", scene.model_dump())

        if not answer and not scene:
            yield _sse("error", {"message": "PANDI could not produce a response. Please try again."})
            return

        sources = _sources_from_text(answer)
        assistant_message = ChatMessage(
            session_id=request.session_id,
            role="assistant",
            content=answer,
            live_search=should_search,
            sources=sources,
            scene=scene,
        )
        await db.pandi_messages.insert_one(assistant_message.model_dump())
        yield _sse(
            "done",
            {
                "message_id": assistant_message.id,
                "content": answer,
                "sources": [source.model_dump() for source in sources],
                "scene": scene.model_dump() if scene else None,
            },
        )
    except Exception:
        logger.exception("PANDI chat stream failed")
        yield _sse("error", {"message": "Live AI or web search is temporarily unavailable. Please retry in a moment."})


@router.post("/chat/stream")
async def stream_chat(request: ChatStreamRequest) -> StreamingResponse:
    _check_rate_limit(request.profile_id or "anonymous")
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
