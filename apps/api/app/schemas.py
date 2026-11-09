"""Pydantic V2 schemas for Sutra data models, LLM outputs, and API contracts."""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


# --- LLM Data Models ---

class ClarifyQuestion(BaseModel):
    id: str = Field(description="Unique question identifier, e.g. q1, q2")
    display_text: str = Field(description="Question in text form for display")
    spoken_text: str = Field(description="Optimized phonetic text for TTS voice reading")
    options: List[str] = Field(default_factory=list, description="Optional quick answer choices")


class ClarifyResult(BaseModel):
    detected_language: str = Field(description="Detected language, e.g. en, hi, hinglish")
    idea_summary: str = Field(description="One-sentence crisp summary of user's core idea")
    questions: List[ClarifyQuestion] = Field(
        default_factory=list,
        description="1 to 2 targeted clarifying questions. Never more than 2.",
    )

    @field_validator("questions")
    @classmethod
    def cap_questions(cls, v: List[ClarifyQuestion]) -> List[ClarifyQuestion]:
        if len(v) > 2:
            return v[:2]
        return v


class PlanMustHave(BaseModel):
    name: str = Field(description="Feature title")
    why: str = Field(description="Why this is non-negotiable for the vertical slice")
    acceptance: List[str] = Field(description="Bullet points of verifiable acceptance criteria")


class PlanBuildStep(BaseModel):
    step: int = Field(description="Sequential step number starting at 1")
    title: str = Field(description="Title of build milestone")
    detail: str = Field(description="Concrete engineering implementation instructions")


class PlanSuggestion(BaseModel):
    id: str = Field(description="Unique identifier, e.g. s1, s2, s3")
    text: str = Field(description="One-sentence proposed enhancement chip")
    impact: str = Field(description="Expected benefit or scope impact")


class Plan(BaseModel):
    title: str = Field(description="Concise product title")
    one_liner: str = Field(description="High-impact punchy one-sentence summary")
    target_user: str = Field(description="Target persona (e.g. solo builders, students in India)")
    problem: str = Field(description="The core problem being solved")
    must_have: List[PlanMustHave] = Field(
        description="Up to 5 absolute must-have core capabilities for the MVP"
    )
    later: List[str] = Field(default_factory=list, description="Pushed to v2 backlog")
    out_of_scope: List[str] = Field(default_factory=list, description="Explicitly not being built")
    build_order: List[PlanBuildStep] = Field(description="Ordered sequence of implementation steps")
    tech_notes: str = Field(description="Architecture, stack, and critical engineering choices")
    risks: List[str] = Field(default_factory=list, description="Technical and product risks")
    assumptions: List[str] = Field(default_factory=list, description="Key assumptions made")
    open_questions: List[str] = Field(default_factory=list, description="Remaining open questions")
    suggestions: List[PlanSuggestion] = Field(
        description="Exactly 3 AI-suggested next iterations"
    )
    first_prompt: str = Field(
        description="Self-contained ready-to-paste prompt for a coding agent with a Do Not Build list"
    )
    language: str = Field(default="en", description="Primary language of the generated plan")

    @field_validator("must_have")
    @classmethod
    def cap_must_have(cls, v: List[PlanMustHave]) -> List[PlanMustHave]:
        if len(v) > 5:
            return v[:5]
        return v


class RefineResult(BaseModel):
    plan: Plan = Field(description="Updated structured plan")
    change_summary: List[str] = Field(
        default_factory=list,
        description="List of bullets explaining what was added, modified, or moved to later",
    )


# --- Storage Document Models ---

class Turn(BaseModel):
    role: Literal["user", "assistant", "system"]
    text: str
    source: Literal["voice", "text"] = "text"
    lang: str = "auto"
    ts: float


class Answer(BaseModel):
    question_id: str
    text: str


class SessionDoc(BaseModel):
    id: str
    device_id: str
    idea_raw: str
    idea_lang: str = "auto"
    turns: List[Turn] = Field(default_factory=list)
    questions: List[ClarifyQuestion] = Field(default_factory=list)
    answers: List[Answer] = Field(default_factory=list)
    status: Literal["created", "clarifying", "ready_for_plan", "completed"] = "created"
    created_at: str
    schema_version: int = 1


class PlanVersion(BaseModel):
    n: int
    plan: Plan
    change_summary: List[str] = Field(default_factory=list)
    created_at: str
    source: Literal["generate", "suggestion"] = "generate"


class PlanDoc(BaseModel):
    id: str
    device_id: str
    session_id: str
    title: str
    versions: List[PlanVersion] = Field(default_factory=list)
    created_at: str
    updated_at: str
    schema_version: int = 1


# --- API Request and Response Models ---

class CreateSessionRequest(BaseModel):
    idea: str = Field(min_length=3, max_length=1500)
    lang: Optional[str] = "auto"
    source: Optional[Literal["voice", "text"]] = "text"


class CreateSessionResponse(BaseModel):
    session_id: str
    questions: List[ClarifyQuestion]


class SubmitAnswersRequest(BaseModel):
    answers: List[Answer]


class SubmitAnswersResponse(BaseModel):
    ready: bool = True


class GeneratePlanResponse(BaseModel):
    plan_id: str
    plan: Plan


class RefinePlanRequest(BaseModel):
    suggestion: str = Field(min_length=2, max_length=1500)
    source: Optional[Literal["voice", "text"]] = "text"


class RefinePlanResponse(BaseModel):
    version: int
    plan: Plan
    change_summary: List[str]


class PlanSummary(BaseModel):
    id: str
    session_id: str
    title: str
    versions_count: int
    latest_version: int
    created_at: str
    updated_at: str


class PlanListResponse(BaseModel):
    plans: List[PlanSummary]


class PlanDetailResponse(BaseModel):
    id: str
    device_id: str
    session_id: str
    title: str
    versions: List[PlanVersion]
    current_version: int
    plan: Plan
    created_at: str
    updated_at: str


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    lang: Optional[str] = "hi-IN"
    voice: Optional[str] = None


class STTResponse(BaseModel):
    transcript: str
    lang: str


class GroqUsage(BaseModel):
    calls: int = 0
    estimated_tokens: int = 0


class GnaniUsage(BaseModel):
    stt_calls: int = 0
    stt_seconds: float = 0.0
    tts_calls: int = 0
    tts_chars: int = 0
    tts_cache_hits: int = 0


class UsageResponse(BaseModel):
    groq: GroqUsage
    gnani: GnaniUsage
