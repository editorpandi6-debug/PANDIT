"""PANDI 3D Creation Engine: design-brief → procedural 3D scene (+ concept image) via the Emergent key.

No Tripo/paid 3D-generation key is configured, so this builds the most accurate PROCEDURAL
(primitive-shape) model it can from a structured design brief, and is honest in the UI about
that limitation instead of claiming photorealism it cannot deliver.
"""

import base64
import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

from lib.db import db
from models.pandi import Creation, CreationRequest, CreationSummary, SceneSpec

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/creation", tags=["creation"])

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
            chat = LlmChat(api_key=api_key, session_id=f"pandi-creation-fb-{prompt[:20]}", system_message=BRIEF_SYSTEM).with_model("gemini", "gemini-3-flash")
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
    api_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not api_key:
        return None
    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

        gen = OpenAIImageGeneration(api_key=api_key)
        prompt = f"Clean concept reference image of a {category}: {name}. {brief} Studio lighting, neutral grey background, product/concept-art style, single object, no text."
        images = await gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1, quality="low")
        if not images:
            return None
        return "data:image/png;base64," + base64.b64encode(images[0]).decode()
    except Exception:
        logger.warning("Concept image generation failed for %s/%s", category, name, exc_info=True)
        return None


@router.post("/generate", response_model=Creation)
async def generate_creation(request: CreationRequest) -> Creation:
    data = await _design_brief(request.prompt)
    objects = data.get("objects") or _fallback_scene(request.prompt)["objects"]
    scene = SceneSpec(
        scene="custom",
        params={"objects": objects},
        title=data.get("name", request.prompt[:40]),
        steps=[],
        stats=[str(data.get("category", "object")).upper(), f"{len(objects)} parts"],
    )
    image_data_url = await _concept_image(data.get("category", "object"), data.get("name", request.prompt), data.get("brief", ""))

    creation = Creation(
        profile_id=request.profile_id,
        prompt=request.prompt,
        category=data.get("category", "object"),
        name=data.get("name", request.prompt[:40]),
        brief=data.get("brief", ""),
        limitations=data.get(
            "limitations",
            "This is a procedural primitive-shape model, not a photorealistic scan. True photorealism needs an external paid 3D-generation service, which is not connected to this app.",
        ),
        scene=scene,
        image_data_url=image_data_url,
    )
    await db.pandi_creations.insert_one(creation.model_dump())
    return creation


@router.get("/gallery/{profile_id}", response_model=list[CreationSummary])
async def list_gallery(profile_id: str) -> list[CreationSummary]:
    rows = await db.pandi_creations.find({"profile_id": profile_id}).sort("created_at", -1).to_list(60)
    return [CreationSummary(**row) for row in rows]


@router.get("/{creation_id}", response_model=Creation)
async def get_creation(creation_id: str) -> Creation:
    row = await db.pandi_creations.find_one({"id": creation_id})
    if not row:
        raise HTTPException(status_code=404, detail="Creation not found")
    return Creation(**row)
