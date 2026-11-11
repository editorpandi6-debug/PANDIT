"""PANDI 3D Creation Engine: design-brief → procedural 3D scene (+ concept image) via the Emergent key.

No Tripo/paid 3D-generation key is configured, so this builds the most accurate PROCEDURAL
(primitive-shape) model it can from a structured design brief, and is honest in the UI about
that limitation instead of claiming photorealism it cannot deliver.
"""

import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

from lib.auth import authorize_profile
from lib.credits import MODEL3D_COST, charge, owner_key, refund
from lib.db import db
from lib.images import generate_image_bytes
from models.pandi import Creation, CreationRequest, CreationSummary, SceneSpec

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/creation", tags=["creation"])

TRIPO_BASE = "https://openapi.tripo3d.ai/v3"
TRIPO_MODEL = "v3.1-20260211"
TRIPO_POLL_SECONDS = 3
TRIPO_MAX_WAIT_SECONDS = 100
TRIPO_TERMINAL_FAILURES = {"failed", "cancelled", "banned", "expired"}

BRIEF_SYSTEM = """You are PANDI's 3D Creation Engine. Given an object description, you design an accurate procedural 3D model.

Work through these steps internally, then answer with STRICT JSON only (no markdown fences, no prose):
1. Identify the object's category: one of vehicle, furniture, building, product, creature, character, other.
2. Identify its defining features, real-world proportions (width:height:depth relationships), structural parts, plausible materials/colors, and the most informative default viewing angle.
3. Write a short, honest design brief (3-5 sentences) describing shape, proportions, parts and materials.
4. Build the object as 8-20 labelled primitive shapes (box, sphere, cylinder, cone, torus, ring, capsule, octahedron, icosahedron, plane) positioned and scaled to closely mirror the REAL proportions and part layout of the object — not a generic cube. Example: a car needs a long low body, a cabin, four cylinder wheels at the correct height; a chair needs four legs, a seat slab, a backrest, correctly proportioned. Coordinates must stay within -6..6. Colors should resemble plausible real materials (metal grey, wood brown #8b5a2b, fabric tones, glass cyan-ish, etc).
5. Write one honest "limitations" sentence noting this is a procedural primitive-shape model (not a photorealistic scanned/generated mesh), and that true photorealism needs an external paid 3D-generation service which is not connected here.

Return exactly this JSON shape:
{"category": "...", "name": "<short title>", "brief": "...", "limitations": "...", "objects": [{"shape": "box", "color": "#8b5a2b", "position": [0,0,0], "size": [1,1,1], "label": "...", "wire": false}, ...]}
"""


def _fallback_scene(prompt: str) -> dict:
    return {
        "category": "object",
        "name": prompt[:40],
        "brief": f"A simplified placeholder form for '{prompt}'. PANDI's AI design step could not be completed this time.",
        "limitations": "This is a basic placeholder shape, not an accurate model. Please try generating again.",
        "objects": [{"shape": "box", "color": "#ff8a1f", "position": [0, 0, 0], "size": [2, 2, 2], "label": prompt[:24], "wire": False}],
    }


def _tripo_key() -> str:
    return os.environ.get("TRIPO_API_KEY", "").strip()


async def _tripo_generate(prompt: str) -> tuple[str | None, str | None]:
    """Submit a Tripo text-to-model task and poll briefly for a GLB. Returns (model_url, error)."""
    key = _tripo_key()
    if not key:
        return None, None
    headers = {"Authorization": f"Bearer {key}"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            create = await client.post(
                f"{TRIPO_BASE}/generation/text-to-model",
                headers=headers,
                json={"prompt": prompt[:1000], "model": TRIPO_MODEL, "texture": True, "pbr": True, "face_limit": 30000},
            )
            if create.status_code >= 400:
                return None, f"Tripo rejected the request (HTTP {create.status_code})."
            body = create.json()
            if body.get("code", 0) != 0:
                return None, f"Tripo error code {body.get('code')}."
            task_id = body["data"]["task_id"]

            waited = 0
            while waited < TRIPO_MAX_WAIT_SECONDS:
                await asyncio.sleep(TRIPO_POLL_SECONDS)
                waited += TRIPO_POLL_SECONDS
                poll = await client.get(f"{TRIPO_BASE}/tasks/{task_id}", headers=headers)
                if poll.status_code >= 400:
                    continue
                data = poll.json().get("data", {})
                status = data.get("status", "unknown")
                if status == "success":
                    model_url = (data.get("output") or {}).get("model_url")
                    return (model_url, None) if model_url else (None, "Tripo finished without a usable model file.")
                if status in TRIPO_TERMINAL_FAILURES:
                    return None, f"Tripo generation {status}: {data.get('error_message', 'no detail')}."
            return None, "Tripo generation timed out; falling back to the procedural preview."
    except Exception as exc:
        logger.warning("Tripo generation failed for %r: %s", prompt, exc)
        return None, "Tripo was unreachable; showing the procedural preview instead."


async def _design_brief(prompt: str) -> dict:
    api_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not api_key:
        return _fallback_scene(prompt)
    try:
        chat = LlmChat(api_key=api_key, session_id=f"pandi-creation-{prompt[:20]}", system_message=BRIEF_SYSTEM).with_model("openai", "gpt-5.1")
        parts: list[str] = []
        async for event in chat.stream_message(UserMessage(text=f"Design a 3D model of: {prompt}")):
            if isinstance(event, TextDelta) and event.content:
                parts.append(event.content)
            elif isinstance(event, StreamDone) and event.content and not parts:
                parts.append(event.content)
        raw = "".join(parts).strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        if not isinstance(data.get("objects"), list) or not data["objects"]:
            raise ValueError("no objects in brief")
        return data
    except Exception:
        logger.exception("3D design brief generation failed for %r; trying fallback model", prompt)
        try:
            chat = LlmChat(api_key=api_key, session_id=f"pandi-creation-fb-{prompt[:20]}", system_message=BRIEF_SYSTEM).with_model("gemini", "gemini-3-flash-preview")
            parts = []
            async for event in chat.stream_message(UserMessage(text=f"Design a 3D model of: {prompt}")):
                if isinstance(event, TextDelta) and event.content:
                    parts.append(event.content)
                elif isinstance(event, StreamDone) and event.content and not parts:
                    parts.append(event.content)
            raw = "".join(parts).strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            data = json.loads(raw)
            if not isinstance(data.get("objects"), list) or not data["objects"]:
                raise ValueError("no objects in brief")
            return data
        except Exception:
            logger.exception("Fallback model also failed for %r", prompt)
            return _fallback_scene(prompt)


async def _concept_image(category: str, name: str, brief: str) -> str | None:
    try:
        prompt = f"Clean concept reference image of a {category}: {name}. {brief} Studio lighting, neutral grey background, product/concept-art style, single object, no text."
        data = await generate_image_bytes(prompt, max_px=512)
        return "data:image/jpeg;base64," + base64.b64encode(data).decode()
    except Exception:
        logger.warning("Concept image generation failed for %s/%s", category, name, exc_info=True)
        return None


@router.post("/generate", response_model=Creation)
async def generate_creation(request: CreationRequest, http_request: Request) -> Creation:
    await authorize_profile(http_request, request.profile_id, ready=True)
    owner, is_user = owner_key(request.profile_id)
    ok, _blocked = await charge(owner, is_user, MODEL3D_COST, "3d", request.prompt)
    if not ok:
        raise HTTPException(status_code=402, detail=f"A 3D model needs {MODEL3D_COST} credits. Your credits reset at 00:00 IST.")
    try:
        return await _generate(request, owner)
    except Exception:
        await refund(owner, MODEL3D_COST, "3D failed — refunded")
        raise


async def _generate(request: CreationRequest, owner: str) -> Creation:
    data = await _design_brief(request.prompt)
    objects = data.get("objects") or _fallback_scene(request.prompt)["objects"]
    scene = SceneSpec(
        scene="custom",
        params={"objects": objects},
        title=data.get("name", request.prompt[:40]),
        steps=[],
        stats=[str(data.get("category", "object")).upper(), f"{len(objects)} parts"],
    )
    tripo_prompt = f"{data.get('name', request.prompt)}: {data.get('brief', request.prompt)}"
    image_data_url, (model_url, tripo_error) = await asyncio.gather(
        _concept_image(data.get("category", "object"), data.get("name", request.prompt), data.get("brief", "")),
        _tripo_generate(tripo_prompt),
    )
    limitations = data.get(
        "limitations",
        "This is a procedural primitive-shape model, not a photorealistic scan. True photorealism needs an external paid 3D-generation service, which is not connected to this app.",
    )
    model_source = "procedural"
    if model_url:
        model_source = "tripo"
        limitations = "Generated by Tripo AI from the design brief above — a real textured mesh, not a primitive placeholder."
    elif _tripo_key():
        # A Tripo key is configured but this generation failed/timed out — be honest, not silent.
        limitations = f"{tripo_error or 'Tripo generation did not complete.'} Showing the procedural preview instead."
    credits_charged = MODEL3D_COST
    if not model_url:
        # Only a real Tripo mesh costs credits; the procedural preview is free.
        await refund(owner, MODEL3D_COST, "3D preview only — refunded")
        credits_charged = 0
        limitations += " No credits were charged for this preview."

    creation = Creation(
        profile_id=request.profile_id,
        prompt=request.prompt,
        category=data.get("category", "object"),
        name=data.get("name", request.prompt[:40]),
        brief=data.get("brief", ""),
        limitations=limitations,
        scene=scene,
        image_data_url=image_data_url,
        model_url=model_url,
        model_source=model_source,
        credits_charged=credits_charged,
    )
    await db.pandi_creations.insert_one(creation.model_dump())
    return creation


@router.get("/gallery/{profile_id}", response_model=list[CreationSummary])
async def list_gallery(profile_id: str, http_request: Request) -> list[CreationSummary]:
    await authorize_profile(http_request, profile_id)
    rows = await db.pandi_creations.find({"profile_id": profile_id}).sort("created_at", -1).to_list(60)
    return [CreationSummary(**row) for row in rows]


@router.get("/{creation_id}", response_model=Creation)
async def get_creation(creation_id: str) -> Creation:
    row = await db.pandi_creations.find_one({"id": creation_id})
    if not row:
        raise HTTPException(status_code=404, detail="Creation not found")
    return Creation(**row)
