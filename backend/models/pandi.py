from datetime import datetime, timezone
from typing import Literal
import uuid

from pydantic import BaseModel, Field


class ProfileUpsert(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    avatar_data_url: str | None = Field(default=None, max_length=2_000_000)


class Profile(BaseModel):
    profile_id: str
    name: str
    avatar_data_url: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SourceRef(BaseModel):
    url: str
    title: str | None = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    live_search: bool = False
    sources: list[SourceRef] = Field(default_factory=list)
    visual_scene: str | None = None


class ChatHistory(BaseModel):
    session_id: str
    messages: list[ChatMessage]


class ChatStreamRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=12_000)
    language: str = "auto"
    use_live_search: bool = True
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