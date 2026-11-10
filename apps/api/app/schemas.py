"""Pydantic V2 schemas for Sutra conforming to apps/web/src/api/types.ts."""

import re
import uuid
from typing import Any, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
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
    id: str = Field(default_factory=lambda: f"q_{uuid.uuid4().hex[:4]}")
    display_text: str
    spoken_text: str = ""
    options: List[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def norm_question(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("id"):
                data["id"] = f"q_{uuid.uuid4().hex[:4]}"
            if not data.get("spoken_text") and data.get("display_text"):
                data["spoken_text"] = data["display_text"]
        return data


class MustHave(CamelModel):
    name: str
    why: str = ""
    acceptance: List[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def norm_must_have(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"name": data, "why": f"Core requirement for {data}", "acceptance": []}
        if isinstance(data, dict):
            if not data.get("name"):
                data["name"] = data.get("feature") or data.get("title") or "Core Feature"
            if not data.get("why"):
                data["why"] = f"Essential for {data.get('name', 'MVP')}"
        return data


class BuildStep(CamelModel):
    step: int = 1
    title: str
    detail: str = ""

    @model_validator(mode="before")
    @classmethod
    def norm_build_step(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"step": 1, "title": data[:60], "detail": data}
        if isinstance(data, dict):
            if "title" not in data:
                data["title"] = str(data.get("description") or data.get("detail") or f"Step {data.get('step', 1)}")[:60]
            if "detail" not in data:
                data["detail"] = str(data.get("description") or data.get("title") or "")
        return data


class Suggestion(CamelModel):
    id: str = Field(default_factory=lambda: f"s_{uuid.uuid4().hex[:4]}")
    text: str
    impact: Literal["low", "medium", "high"] = "medium"

    @model_validator(mode="before")
    @classmethod
    def norm_suggestion(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"id": f"s_{uuid.uuid4().hex[:4]}", "text": data, "impact": "medium"}
        if isinstance(data, dict):
            if not data.get("id"):
                data["id"] = f"s_{uuid.uuid4().hex[:4]}"
            if "impact" in data:
                data["impact"] = str(data["impact"]).lower()
                if data["impact"] not in ("low", "medium", "high"):
                    data["impact"] = "medium"
        return data


class Plan(CamelModel):
    title: str
    one_liner: str
    target_user: str
    problem: str
    must_have: List[MustHave] = Field(description="Max 5 items")
    later: List[str] = Field(default_factory=list)
    out_of_scope: List[str] = Field(default_factory=list)
    build_order: List[BuildStep]
    tech_notes: str = ""
    risks: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    open_questions: List[str] = Field(default_factory=list)
    suggestions: List[Suggestion] = Field(default_factory=list)
    first_prompt: str = ""
    language: Lang = "en"

    @model_validator(mode="before")
    @classmethod
    def norm_plan(cls, data: Any) -> Any:
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            data = data[0]
        if isinstance(data, dict):
            if isinstance(data.get("tech_notes"), dict):
                data["tech_notes"] = "\n".join(f"- **{k}**: {v}" for k, v in data["tech_notes"].items())
            elif not data.get("tech_notes"):
                data["tech_notes"] = "Full stack modern architecture."

            if isinstance(data.get("build_order"), list):
                norm_steps = []
                for idx, s in enumerate(data["build_order"]):
                    if isinstance(s, str):
                        norm_steps.append({"step": idx + 1, "title": s[:60], "detail": s})
                    elif isinstance(s, dict):
                        s["step"] = idx + 1
                        norm_steps.append(s)
                data["build_order"] = norm_steps

            if not data.get("first_prompt"):
                data["first_prompt"] = f"Let's build {data.get('title', 'this project')}. Where should we start?"
        return data

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
