"""Pydantic V2 schemas for Sutra conforming to apps/web/src/api/types.ts."""

import re
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

Lang = Literal["en", "hi", "hinglish"]
LangMode = Literal["auto", "en", "hi", "hinglish"]
InputSource = Literal["voice", "text"]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# --- Core Entities matching apps/web/src/api/types.ts ---

class Question(CamelModel):
    id: str
    display_text: str
    spoken_text: str
    options: List[str] = Field(default_factory=list)


class MustHave(CamelModel):
    name: str
    why: str
    acceptance: List[str] = Field(default_factory=list)


class BuildStep(CamelModel):
    step: int
    title: str
    detail: str


class Suggestion(CamelModel):
    id: str
    text: str
    impact: Literal["low", "medium", "high"] = "medium"


class Plan(CamelModel):
    title: str
    one_liner: str
    target_user: str
    problem: str
    must_have: List[MustHave] = Field(description="Max 5 items")
    later: List[str] = Field(default_factory=list)
    out_of_scope: List[str] = Field(default_factory=list)
    build_order: List[BuildStep]
    tech_notes: str
    risks: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    open_questions: List[str] = Field(default_factory=list)
    suggestions: List[Suggestion]
    first_prompt: str
    language: Lang = "en"

    @field_validator("must_have")
    @classmethod
    def cap_must_have(cls, v: List[MustHave]) -> List[MustHave]:
        if len(v) > 5:
            return v[:5]
        return v


class PlanDoc(CamelModel):
    id: str
    version: int
    plan: Plan
    change_summary: List[str] = Field(default_factory=list)

    @field_validator("id")
    @classmethod
    def validate_plan_id(cls, v: str) -> str:
        if not re.match(r"^[\w-]+$", v):
            raise ValueError(f"Plan ID '{v}' must match regex ^[\\w-]+$")
        return v


# --- API Request and Response Models ---

class CreateSessionInput(CamelModel):
    idea: str
    lang: LangMode = "auto"
    source: InputSource = "text"


class CreateSessionResult(CamelModel):
    session_id: str
    detected_lang: Lang
    questions: List[Question] = Field(default_factory=list)

    @field_validator("questions")
    @classmethod
    def cap_questions(cls, v: List[Question]) -> List[Question]:
        if len(v) > 2:
            return v[:2]
        return v


class AnswerInput(CamelModel):
    question_id: str
    text: str


class GeneratePlanInput(CamelModel):
    answers: List[AnswerInput] = Field(default_factory=list)


class ChatInput(CamelModel):
    message: str
    source: InputSource = "text"
    lang: LangMode = "auto"


class ChatResult(CamelModel):
    reply: str
    spoken_reply: str
    plan: Optional[PlanDoc] = None
    change_summary: List[str] = Field(default_factory=list)


class TTSInput(CamelModel):
    text: str
    lang: str = "hi"


class GroqUsage(CamelModel):
    calls: int = 0
    estimated_tokens: int = 0


class GnaniUsage(CamelModel):
    stt_calls: int = 0
    stt_seconds: float = 0.0
    tts_calls: int = 0
    tts_chars: int = 0
    tts_cache_hits: int = 0


class UsageResponse(CamelModel):
    groq: GroqUsage
    gnani: GnaniUsage


# --- Storage Models ---

class Turn(CamelModel):
    role: Literal["user", "assistant", "system"]
    text: str
    source: InputSource = "text"
    lang: str = "auto"
    ts: float


class SessionDoc(CamelModel):
    id: str
    device_id: str
    idea_raw: str
    idea_lang: Lang = "en"
    turns: List[Turn] = Field(default_factory=list)
    questions: List[Question] = Field(default_factory=list)
    answers: List[AnswerInput] = Field(default_factory=list)
    status: Literal["created", "clarifying", "ready_for_plan", "completed"] = "created"
    created_at: str
    schema_version: int = 1


class StoredPlanVersion(CamelModel):
    n: int
    plan: Plan
    change_summary: List[str] = Field(default_factory=list)
    created_at: str
    source: Literal["generate", "chat"] = "generate"


class PlanStorageDoc(CamelModel):
    id: str
    device_id: str
    session_id: str
    title: str
    versions: List[StoredPlanVersion] = Field(default_factory=list)
    chat_turns: List[Turn] = Field(default_factory=list)
    created_at: str
    updated_at: str
    schema_version: int = 1
