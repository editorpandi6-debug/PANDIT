"""Daily usage credits. Everything resets at 00:00 IST; nothing carries over. Enforced server-side.

Chat is free. An image costs IMAGE_COST credits + 1 image slot, a 3D model costs MODEL3D_COST credits.
"""

import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from pymongo import ReturnDocument

from lib.db import db
from models.account import CreditEvent, CreditStatus

IST = ZoneInfo("Asia/Kolkata")
IMAGE_COST = 5
MODEL3D_COST = 15
IMAGE_LIMIT_MESSAGE = "You have used all your images for today. Your image limit resets at 00:00 IST."


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def limits(is_user: bool) -> tuple[int, int]:
    """(daily credits, daily images) for signed-in members vs guests."""
    if is_user:
        return _int_env("CREDITS_DAILY_MEMBER", 50), _int_env("IMAGE_DAILY_LIMIT_PAID", 7)
    return _int_env("CREDITS_DAILY_GUEST", 10), _int_env("IMAGE_DAILY_LIMIT_GUEST", 2)


def lock_chat_at_zero() -> bool:
    return os.environ.get("LOCK_CHAT_AT_ZERO", "true").lower() != "false"


def ist_day() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def seconds_to_reset() -> int:
    now = datetime.now(IST)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((midnight - now).total_seconds()))


def owner_key(profile_id: str | None) -> tuple[str, bool]:
    """(usage owner, is signed-in member). Callers must have run authorize_profile first."""
    if profile_id and profile_id.startswith("user_"):
        return profile_id, True
    return f"guest:{profile_id or 'anonymous'}", False


async def _usage(owner: str) -> dict:
    return await db.pandi_usage.find_one_and_update(
        {"owner": owner, "day": ist_day()},
        {"$setOnInsert": {"credits_used": 0, "images_used": 0, "events": []}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )


async def get_status(owner: str, is_user: bool) -> CreditStatus:
    credits_total, images_total = limits(is_user)
    doc = await _usage(owner)
    credits_left = max(0, credits_total - doc["credits_used"])
    images_left = max(0, images_total - doc["images_used"])
    events = []
    for event in reversed(doc.get("events", [])[-40:]):
        at = event["at"]
        events.append(CreditEvent(**{**event, "at": at.replace(tzinfo=timezone.utc) if at.tzinfo is None else at}))
    return CreditStatus(
        tier="Member" if is_user else "Guest",
        credits_total=credits_total,
        credits_left=credits_left,
        images_total=images_total,
        images_used=min(images_total, doc["images_used"]),
        images_left=images_left,
        seconds_to_reset=seconds_to_reset(),
        low=0 < credits_left < credits_total * 0.2,
        locked=credits_left <= 0 and lock_chat_at_zero(),
        image_cost=IMAGE_COST,
        model3d_cost=MODEL3D_COST,
        events=events,
    )


async def charge(owner: str, is_user: bool, cost: int, kind: str, note: str, image: bool = False) -> tuple[bool, str | None]:
    """Atomically take `cost` credits (and one image slot). Returns (ok, blocked_by) with blocked_by 'images' | 'credits'."""
    credits_total, images_total = limits(is_user)
    await _usage(owner)
    query: dict = {"owner": owner, "day": ist_day(), "credits_used": {"$lte": credits_total - cost}}
    inc = {"credits_used": cost}
    if image:
        query["images_used"] = {"$lt": images_total}
        inc["images_used"] = 1
    event = {"kind": kind, "credits": -cost, "note": note[:80], "at": datetime.now(timezone.utc)}
    updated = await db.pandi_usage.find_one_and_update(query, {"$inc": inc, "$push": {"events": event}})
    if updated:
        return True, None
    doc = await _usage(owner)
    if image and doc["images_used"] >= images_total:
        return False, "images"
    return False, "credits"


async def refund(owner: str, cost: int, note: str, image: bool = False) -> None:
    inc = {"credits_used": -cost}
    if image:
        inc["images_used"] = -1
    event = {"kind": "refund", "credits": cost, "note": note[:80], "at": datetime.now(timezone.utc)}
    await db.pandi_usage.update_one({"owner": owner, "day": ist_day()}, {"$inc": inc, "$push": {"events": event}})
