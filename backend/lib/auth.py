"""Session auth: httpOnly `session_token` cookie (Bearer header as fallback), shared by email and Google sign-in."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response

from lib.db import db

SESSION_COOKIE = "session_token"
SESSION_DAYS = 7


async def create_session(user_id: str, token: str) -> None:
    now = datetime.now(timezone.utc)
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": token, "created_at": now, "expires_at": now + timedelta(days=SESSION_DAYS)})


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, secure=True, samesite="none", path="/")


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", secure=True, samesite="none", httponly=True)


def session_token(request: Request) -> str | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        header = request.headers.get("Authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:].strip()
    return token or None


async def current_user(request: Request) -> dict | None:
    token = session_token(request)
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})


def needs_age(user: dict) -> bool:
    return user.get("age") is None


def needs_consent(user: dict) -> bool:
    age = user.get("age")
    return age is not None and age < 18 and not user.get("parent_consent")


async def authorize_profile(request: Request, profile_id: str | None, ready: bool = False) -> dict | None:
    """Account profiles (`user_…`) are only reachable with that account's session; guest profiles are open.

    With ready=True the account must also have finished the age step (and guardian consent if under 18).
    """
    if not profile_id or not profile_id.startswith("user_"):
        return None
    user = await current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in again.")
    if user["user_id"] != profile_id:
        raise HTTPException(status_code=403, detail="This profile belongs to another account.")
    if ready and needs_age(user):
        raise HTTPException(status_code=403, detail="Please tell us your age before using Pandi AI Mark 2.")
    if ready and needs_consent(user):
        raise HTTPException(status_code=403, detail="A parent or guardian must give consent before this account can be used.")
    return user


async def authorize_session(request: Request, session_id: str) -> None:
    row = await db.pandi_sessions.find_one({"session_id": session_id}, {"_id": 0, "profile_id": 1})
    if row:
        await authorize_profile(request, row.get("profile_id"))
