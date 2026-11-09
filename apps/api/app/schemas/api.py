"""API request and response schemas (Pydantic V2)."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)


class ProjectResponse(BaseModel):
    id: UUID | str
    owner_id: UUID | str
    name: str
    created_at: datetime
    updated_at: datetime


class SessionResponse(BaseModel):
    id: UUID | str
    project_id: UUID | str
    owner_id: UUID | str
    status: str
    created_at: datetime
    updated_at: datetime


class TranscriptCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    raw_text: str = Field(min_length=1, max_length=12000)
    lang_hint: str = Field(default="en", max_length=16)


class TranscriptResponse(BaseModel):
    id: UUID | str
    session_id: UUID | str
    owner_id: UUID | str
    raw_text: str
    source: str = "typed"
    detected_langs: list[str] = Field(default_factory=list)
    created_at: datetime


class AnswerItem(BaseModel):
    question_id: str = Field(min_length=1)
    answer_text: str = Field(min_length=1)


class AnswersSubmit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: list[AnswerItem] = Field(min_length=1)


class SpecVersionResponse(BaseModel):
    id: UUID | str
    session_id: UUID | str
    spec_json: dict[str, Any]
    readiness_score: int
    markdown_text: str
    created_at: datetime
