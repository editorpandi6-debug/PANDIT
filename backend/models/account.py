from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserSettings(BaseModel):
    voice_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    silence_ms: int = Field(default=2000, ge=500, le=10_000)
    start_word: str = Field(default="Hey Pandi", min_length=2, max_length=40)
    wake_enabled: bool = True
    large_text: bool = False


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=20)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=1, max_length=128)


class GoogleSessionRequest(BaseModel):
    session_id: str = Field(min_length=4, max_length=500)


class AgeUpdate(BaseModel):
    age: int = Field(ge=5, le=75)  # 75 means "75+"
    parent_email: str | None = Field(default=None, max_length=200)
    parent_consent: bool = False


class AuthUser(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str | None = None
    provider: Literal["google", "email"]
    age: int | None = None
    parent_email: str | None = None
    parent_consent: bool = False
    needs_age: bool
    needs_consent: bool
    settings: UserSettings


class CreditEvent(BaseModel):
    kind: Literal["image", "3d", "refund"]
    credits: int
    note: str = ""
    at: datetime


class CreditStatus(BaseModel):
    tier: Literal["Guest", "Member"]
    credits_total: int
    credits_left: int
    images_total: int
    images_used: int
    images_left: int
    seconds_to_reset: int
    low: bool
    locked: bool
    image_cost: int
    model3d_cost: int
    events: list[CreditEvent] = Field(default_factory=list)
