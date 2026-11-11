"""Sign-in: email + password, Emergent-managed Google sign-in, age + guardian consent, per-user settings."""

import logging
import re
import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone

import bcrypt
import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from lib.auth import clear_session_cookie, create_session, current_user, needs_age, needs_consent, session_token, set_session_cookie
from lib.db import db
from models.account import AgeUpdate, AuthUser, GoogleSessionRequest, LoginRequest, RegisterRequest, UserSettings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LOGIN_FAIL_MAX = 5
LOGIN_FAIL_WINDOW_S = 600
_login_fails: dict[str, deque] = defaultdict(deque)


def _public(user: dict) -> AuthUser:
    return AuthUser(
        user_id=user["user_id"],
        email=user["email"],
        name=user["name"],
        picture=user.get("picture"),
        provider=user.get("provider", "email"),
        age=user.get("age"),
        parent_email=user.get("parent_email"),
        parent_consent=bool(user.get("parent_consent")),
        needs_age=needs_age(user),
        needs_consent=needs_consent(user),
        settings=UserSettings(**(user.get("settings") or {})),
    )


async def _ensure_profile(user: dict) -> None:
    """Every account owns a chat profile with profile_id == user_id."""
    now = datetime.now(timezone.utc)
    await db.pandi_profiles.update_one(
        {"profile_id": user["user_id"]},
        {"$setOnInsert": {"profile_id": user["user_id"], "name": user["name"][:20], "avatar_data_url": None, "memory": [], "voice_mode": "text", "theme": "agni", "created_at": now, "updated_at": now}},
        upsert=True,
    )


async def _start_session(response: Response, user: dict, token: str | None = None) -> AuthUser:
    token = token or secrets.token_urlsafe(32)
    await create_session(user["user_id"], token)
    set_session_cookie(response, token)
    await _ensure_profile(user)
    return _public(user)


@router.post("/register", response_model=AuthUser, status_code=201)
async def register(body: RegisterRequest, response: Response) -> AuthUser:
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1}):
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in instead.")
    user = {
        "user_id": f"user_{uuid.uuid4().hex}",
        "email": email,
        "name": body.name.strip(),
        "picture": None,
        "provider": "email",
        "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(dict(user))
    return await _start_session(response, user)


@router.post("/login", response_model=AuthUser)
async def login(body: LoginRequest, response: Response) -> AuthUser:
    email = body.email.strip().lower()
    now = time.time()
    fails = _login_fails[email]
    while fails and now - fails[0] > LOGIN_FAIL_WINDOW_S:
        fails.popleft()
    if len(fails) >= LOGIN_FAIL_MAX:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please wait a few minutes and try again.")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user and not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="This account uses Google sign-in. Please continue with Google.")
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        fails.append(now)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    fails.clear()
    return await _start_session(response, user)


@router.post("/google/session", response_model=AuthUser)
async def google_session(body: GoogleSessionRequest, response: Response) -> AuthUser:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            res = await client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Google sign-in is temporarily unavailable. Please try again.") from exc
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Please try again.")
    data = res.json()
    email = str(data.get("email", "")).strip().lower()
    if not EMAIL_RE.match(email) or not data.get("session_token"):
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Please try again.")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": data.get("picture") or user.get("picture")}})
    else:
        user = {
            "user_id": f"user_{uuid.uuid4().hex}",
            "email": email,
            "name": (str(data.get("name") or email.split("@")[0]).strip() or "Operator")[:20],
            "picture": data.get("picture"),
            "provider": "google",
            "created_at": datetime.now(timezone.utc),
        }
        if len(user["name"]) < 2:
            user["name"] = "Operator"
        await db.users.insert_one(dict(user))
    return await _start_session(response, user, token=data["session_token"])


@router.get("/me", response_model=AuthUser)
async def me(request: Request) -> AuthUser:
    user = await current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not signed in.")
    return _public(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response) -> None:
    token = session_token(request)
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    clear_session_cookie(response)


@router.put("/age", response_model=AuthUser)
async def set_age(body: AgeUpdate, request: Request) -> AuthUser:
    user = await current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not signed in.")
    update: dict = {"age": body.age}
    if body.age < 18:
        parent_email = (body.parent_email or "").strip().lower()
        if not EMAIL_RE.match(parent_email):
            raise HTTPException(status_code=422, detail="Please enter a valid parent or guardian email.")
        if parent_email == user["email"]:
            raise HTTPException(status_code=422, detail="The parent or guardian email must be different from your own email.")
        if not body.parent_consent:
            raise HTTPException(status_code=422, detail="A parent or guardian must give consent before this account can be used.")
        update.update({"parent_email": parent_email, "parent_consent": True, "parent_consent_at": datetime.now(timezone.utc)})
    else:
        update.update({"parent_email": None, "parent_consent": False})
    if body.age >= 60 and "settings" not in user:
        update["settings"] = UserSettings(large_text=True).model_dump()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return _public({**user, **update})


@router.put("/settings", response_model=AuthUser)
async def save_settings(body: UserSettings, request: Request) -> AuthUser:
    user = await current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not signed in.")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"settings": body.model_dump()}})
    return _public({**user, "settings": body.model_dump()})
