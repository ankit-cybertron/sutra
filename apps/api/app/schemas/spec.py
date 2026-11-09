from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Span(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: int = Field(ge=0)
    end: int = Field(ge=0)


class Claim(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    topic: str = Field(min_length=1)
    value: str = Field(min_length=1)
    stance: Literal["assert", "revise", "retract", "tentative"]
    revises: str | None = None
    span: Span
    lang: str = "en"


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    topic: str = Field(min_length=1)
    final: str = Field(min_length=1)
    superseded: list[str] = Field(default_factory=list)
    evidence: list[Span] = Field(default_factory=list)


class RevisionTraceStep(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str = Field(min_length=1)
    stance: Literal["assert", "revise", "retract", "tentative"]
    span: Span
    superseded: bool = False


class RevisionTrace(BaseModel):
    model_config = ConfigDict(extra="forbid")
    topic: str = Field(min_length=1)
    steps: list[RevisionTraceStep] = Field(min_length=1)


class Assumption(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    statement: str = Field(min_length=1)
    risk: Literal["low", "medium", "high"]
    status: Literal["open", "confirmed", "rejected"] = "open"


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    why_it_matters: str = Field(min_length=1)
    impact: int = Field(ge=1, le=5)
    options: list[str] = Field(default_factory=list)


class Problem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    statement: str = Field(min_length=10)
    narrow_user: str = Field(min_length=3)
    why_now: str | None = None


class CoreLoopStep(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step: int = Field(ge=1)
    actor: str = Field(min_length=1)
    action: str = Field(min_length=1)
    outcome: str = Field(min_length=1)


class Scope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    must: list[str] = Field(min_length=1)
    should: list[str] = Field(default_factory=list)
    wont_now: list[str] = Field(min_length=1)
    cut_line: str = Field(min_length=10)


class UserStory(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    as_a: str = Field(min_length=1)
    i_want: str = Field(min_length=1)
    so_that: str = Field(min_length=1)
    priority: Literal["must", "should"]


class FieldDef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    required: bool = True
    notes: str = ""


class Entity(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1)
    fields: list[FieldDef] = Field(min_length=1)
    relations: list[str] = Field(default_factory=list)


class DataModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entities: list[Entity] = Field(min_length=1)


class ScreenStates(BaseModel):
    model_config = ConfigDict(extra="forbid")
    empty: str = Field(min_length=1)
    loading: str = Field(min_length=1)
    error: str = Field(min_length=1)
    success: str = Field(min_length=1)


class Screen(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1)
    purpose: str = Field(min_length=1)
    states: ScreenStates


class EdgeCase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    case: str = Field(min_length=1)
    handling: str = Field(min_length=1)


class AcceptanceCriterion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    given: str = Field(min_length=1)
    when: str = Field(min_length=1)
    then: str = Field(min_length=1)
    story: str = Field(min_length=1)


class ScoreBreakdownItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    component: str
    earned: int
    max: int
    reason: str


class ReadinessScore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    score: int = Field(ge=0, le=100)
    breakdown: list[ScoreBreakdownItem]


class Spec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: str = "1.0"
    title: str = Field(min_length=1, max_length=120)
    tagline: str = Field(min_length=1, max_length=240)
    problem: Problem
    core_loop: list[CoreLoopStep] = Field(min_length=3, max_length=7)
    scope: Scope
    user_stories: list[UserStory] = Field(min_length=1)
    data_model: DataModel
    screens: list[Screen] = Field(min_length=1)
    edge_cases: list[EdgeCase] = Field(min_length=1)
    acceptance_criteria: list[AcceptanceCriterion] = Field(min_length=1)
    first_prompt: str = Field(min_length=20, max_length=2500)
    decisions: list[Decision] = Field(min_length=1)
    assumptions: list[Assumption] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_spec_invariants(self) -> "Spec":
        # 1. Unique IDs in user stories
        story_ids = set()
        must_story_ids = set()
        for story in self.user_stories:
            if story.id in story_ids:
                raise ValueError(f"Duplicate user story ID: {story.id}")
            story_ids.add(story.id)
            if story.priority == "must":
                must_story_ids.add(story.id)

        # 2. Acceptance criteria referencing existing user stories
        ac_ids = set()
        covered_story_ids = set()
        for ac in self.acceptance_criteria:
            if ac.id in ac_ids:
                raise ValueError(f"Duplicate acceptance criteria ID: {ac.id}")
            ac_ids.add(ac.id)
            if ac.story not in story_ids:
                raise ValueError(
                    f"Acceptance criterion {ac.id} references non-existent story: {ac.story}"
                )
            covered_story_ids.add(ac.story)

        # 3. Every must user story covered by at least one AC
        uncovered_musts = must_story_ids - covered_story_ids
        if uncovered_musts:
            raise ValueError(
                f"Must user stories not covered by acceptance criteria: {uncovered_musts}"
            )

        # 4. First prompt must have explicit 'Do not build' section
        lower_prompt = self.first_prompt.lower()
        if "do not build" not in lower_prompt:
            raise ValueError("first_prompt must contain an explicit 'Do not build' section")

        # 5. Unique IDs in assumptions
        assumption_ids = set()
        for assumption in self.assumptions:
            if assumption.id in assumption_ids:
                raise ValueError(f"Duplicate assumption ID: {assumption.id}")
            assumption_ids.add(assumption.id)

        return self
