from datetime import datetime, timezone
from typing import Any, Literal
import uuid

from pydantic import BaseModel, Field, field_validator


def _aware(value: datetime) -> datetime:
    """Motor returns naive UTC datetimes; make them aware so JSON carries the offset."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class Stamped(BaseModel):
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("created_at", "updated_at", mode="after")
    @classmethod
    def _tz(cls, value: datetime) -> datetime:
        return _aware(value)


class ProfileUpsert(BaseModel):
    name: str = Field(min_length=2, max_length=20)
    avatar_data_url: str | None = Field(default=None, max_length=2_000_000)
    voice_mode: Literal["voice", "text"] | None = None
    theme: Literal["agni", "vajra"] | None = None


class Profile(Stamped):
    profile_id: str
    name: str
    avatar_data_url: str | None = None
    memory: list[str] = Field(default_factory=list)
    voice_mode: Literal["voice", "text"] = "text"
    theme: Literal["agni", "vajra"] = "agni"


class MemoryUpdate(BaseModel):
    memory: list[str] = Field(default_factory=list, max_length=60)


class SourceRef(BaseModel):
    url: str
    title: str | None = None


class SceneSpec(BaseModel):
    """Structured 3D scene the LLM asks the Virtual Lab to render."""

    scene: str
    params: dict[str, Any] = Field(default_factory=dict)
    title: str = ""
    steps: list[str] = Field(default_factory=list)
    stats: list[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    live_search: bool = False
    sources: list[SourceRef] = Field(default_factory=list)
    scene: SceneSpec | None = None
    attachments: list[str] = Field(default_factory=list)
    image_url: str | None = None

    @field_validator("created_at", mode="after")
    @classmethod
    def _tz(cls, value: datetime) -> datetime:
        return _aware(value)


class ChatHistory(BaseModel):
    session_id: str
    messages: list[ChatMessage]


class ChatSession(Stamped):
    session_id: str
    profile_id: str
    title: str


class SessionRename(BaseModel):
    title: str = Field(min_length=1, max_length=80)


class ChatStreamRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    profile_id: str | None = Field(default=None, max_length=120)
    message: str = Field(min_length=1, max_length=12_000)
    language: str = "auto"
    model: str = "gpt-5.1"
    use_live_search: bool = True  # auto: search only when the question needs current information
    force_search: bool = False  # chat "Search" toggle: always search the live web
    force_image: bool = False  # chat "Create image" button
    file_ids: list[str] = Field(default_factory=list, max_length=8)


class FileUploadResponse(BaseModel):
    file_id: str
    filename: str
    mime_type: str
    size: int
    status: Literal["ready"] = "ready"


class TodayResponse(BaseModel):
    today: str
    utc_timestamp: datetime


class VoiceStatus(BaseModel):
    configured: bool
    provider: Literal["fish_audio", "elevenlabs", "browser"]
    voice_id: str | None = None
    cloned: bool = False
    detail: str


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4_000)


class TranscribeResponse(BaseModel):
    text: str


class IntroVideoResponse(BaseModel):
    video_url: str


class CreationRequest(BaseModel):
    profile_id: str = Field(min_length=1, max_length=120)
    prompt: str = Field(min_length=2, max_length=500)


class Creation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    prompt: str
    category: str = "object"
    name: str = ""
    brief: str = ""
    limitations: str = ""
    scene: SceneSpec
    image_data_url: str | None = None
    model_url: str | None = None
    model_source: Literal["tripo", "procedural"] = "procedural"
    credits_charged: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("created_at", mode="after")
    @classmethod
    def _tz(cls, value: datetime) -> datetime:
        return _aware(value)


class CreationSummary(BaseModel):
    id: str
    prompt: str
    category: str
    name: str
    image_data_url: str | None = None
    created_at: datetime


class OwnerStatus(BaseModel):
    is_owner: bool
    claimed: bool


class OwnerOverview(BaseModel):
    total_profiles: int
    total_messages: int
    total_creations: int
    claimed_at: datetime
