"""OpenAI image generation with a fallback chain (config/models.py::IMAGE_MODELS), stored in Mongo as JPEG."""

import asyncio
import io
import logging
import os
import uuid
from datetime import datetime, timezone

from bson.binary import Binary
from PIL import Image

from config.models import IMAGE_MODELS
from lib.db import db

logger = logging.getLogger(__name__)


def _to_jpeg(raw: bytes, max_px: int | None) -> bytes:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    if max_px:
        img.thumbnail((max_px, max_px))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue()


async def generate_image_bytes(prompt: str, max_px: int | None = None) -> bytes:
    """Returns JPEG bytes. Raises RuntimeError when every configured image model fails."""
    from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

    keys = {"own": os.environ.get("OPENAI_API_KEY", "").strip(), "emergent": os.environ.get("EMERGENT_LLM_KEY", "").strip()}
    last_error = "no image key configured"
    for key_name, model in IMAGE_MODELS:
        key = keys.get(key_name, "")
        if not key:
            continue
        try:
            images = await OpenAIImageGeneration(api_key=key).generate_images(prompt=prompt, model=model, number_of_images=1)
            if images:
                return await asyncio.to_thread(_to_jpeg, images[0], max_px)
            last_error = "no image returned"
        except Exception as exc:
            last_error = str(exc)[:200]
            logger.warning("Image model %s (%s key) failed: %s", model, key_name, last_error)
    raise RuntimeError(last_error)


async def store_image(data: bytes, owner: str, prompt: str) -> str:
    image_id = str(uuid.uuid4())
    await db.pandi_images.insert_one({"image_id": image_id, "owner": owner, "prompt": prompt[:500], "mime": "image/jpeg", "data": Binary(data), "created_at": datetime.now(timezone.utc)})
    return image_id
