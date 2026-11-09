import hashlib
from typing import Any, TypeVar

from pydantic import BaseModel

from app.schemas.spec import (
    AcceptanceCriterion,
    Assumption,
    Claim,
    CoreLoopStep,
    DataModel,
    Decision,
    EdgeCase,
    Entity,
    FieldDef,
    Problem,
    Question,
    Scope,
    Screen,
    ScreenStates,
    Span,
    Spec,
    UserStory,
)

T = TypeVar("T", bound=BaseModel)


class ClaimExtractionResult(BaseModel):
    claims: list[Claim]


class GapAnalysisResult(BaseModel):
    assumptions: list[Assumption]
    questions: list[Question]


DEFAULT_SPEC = Spec(
    title="Clinic Slots",
    tagline="Request-and-approve booking for a two-therapist physio clinic.",
    problem=Problem(
        statement="Physiotherapy patients in Bangalore struggle to book appointment slots without extensive phone calls back and forth.",
        narrow_user="A 45-year-old chronic knee pain patient seeking bi-weekly physical therapy sessions.",
        why_now="Clinics are overburdened with receptionist administrative load.",
    ),
    core_loop=[
        CoreLoopStep(step=1, actor="Patient", action="selects an open slot and submits request", outcome="Booking request generated"),
        CoreLoopStep(step=2, actor="Therapist", action="receives WhatsApp notification and approves", outcome="Slot confirmed"),
        CoreLoopStep(step=3, actor="Patient", action="receives confirmation link with calendar invite", outcome="Appointment secured"),
    ],
    scope=Scope(
        must=["Slot listing", "Patient booking form", "WhatsApp approval trigger"],
        should=["Email reminders"],
        wont_now=["In-app payments (direct clinic pay only)"],
        cut_line="V1 handles booking request creation and WhatsApp approval without payment integration.",
    ),
    user_stories=[
        UserStory(id="US1", as_a="patient", i_want="to pick a slot", so_that="I can request an appointment", priority="must"),
        UserStory(id="US2", as_a="therapist", i_want="to approve slots on WhatsApp", so_that="I don't have to manage a complex dashboard", priority="must"),
    ],
    data_model=DataModel(
        entities=[
            Entity(
                name="Slot",
                fields=[
                    FieldDef(name="id", type="uuid", required=True, notes="Primary key"),
                    FieldDef(name="starts_at", type="timestamptz", required=True, notes="Slot start time"),
                    FieldDef(name="therapist_id", type="uuid", required=True, notes="Foreign key"),
                ],
                relations=["Therapist 1:N Slot"],
            ),
            Entity(
                name="Therapist",
                fields=[
                    FieldDef(name="id", type="uuid", required=True, notes="Primary key"),
                    FieldDef(name="name", type="text", required=True, notes="Therapist name"),
                ],
                relations=[],
            ),
        ]
    ),
    screens=[
        Screen(
            name="Request Page",
            purpose="Allows patients to browse available therapist slots and submit booking requests.",
            states=ScreenStates(
                empty="No therapists or slots currently scheduled.",
                loading="Fetching available clinic slots...",
                error="Unable to load slots. Please check connection.",
                success="Slots displayed with booking form modal.",
            ),
        )
    ],
    edge_cases=[
        EdgeCase(case="Two patients request same slot simultaneously", handling="First approved request wins; second is notified and prompted to rebook."),
        EdgeCase(case="Therapist rejects request", handling="Patient receives instant WhatsApp notification with alternative slots."),
        EdgeCase(case="Request expires after 2 hours without response", handling="Request auto-cancels and slot returns to open inventory."),
    ],
    acceptance_criteria=[
        AcceptanceCriterion(id="AC1", given="A patient selects an open slot", when="They click Submit Request", then="A SlotRequest is created with status pending", story="US1"),
        AcceptanceCriterion(id="AC2", given="A therapist receives approval message", when="They click Approve", then="Slot status updates to confirmed", story="US2"),
    ],
    first_prompt="Build the Clinic Slots Next.js frontend with Tailwind and FastAPI booking endpoint.\n\nDo not build payments, user authentication, or receptionist management portal in this phase.",
    decisions=[
        Decision(
            topic="booking.approval",
            final="owner approves via WhatsApp",
            superseded=["owner approves in dashboard"],
            evidence=[Span(start=10, end=80)],
        )
    ],
    assumptions=[
        Assumption(id="A1", statement="Therapist has active WhatsApp business number", risk="low", status="open")
    ],
    open_questions=[],
)


class FakeLLMProvider:
    def __init__(self, fixtures: dict[str, Any] | None = None) -> None:
        self.fixtures: dict[str, Any] = fixtures or {}
        self.call_history: list[dict[str, Any]] = []

    def register_fixture(self, key: str, value: Any) -> None:
        self.fixtures[key] = value

    @staticmethod
    def compute_hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]

    async def structured(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        temperature: float = 0.0,
        timeout_s: float = 30.0,
    ) -> T:
        input_hash = self.compute_hash(user)
        self.call_history.append({
            "system": system,
            "user": user,
            "schema": schema.__name__,
            "hash": input_hash,
        })

        # 1. Direct fixture lookup by hash
        if input_hash in self.fixtures:
            data = self.fixtures[input_hash]
            if isinstance(data, schema):
                return data
            if isinstance(data, dict):
                return schema.model_validate(data)

        # 2. Schema-based fallback fixtures
        if schema is ClaimExtractionResult:
            return schema.model_validate({
                "claims": [
                    {
                        "id": "c1",
                        "topic": "booking.approval",
                        "value": "owner approves in dashboard",
                        "stance": "assert",
                        "revises": None,
                        "span": {"start": 0, "end": 35},
                        "lang": "en",
                    },
                    {
                        "id": "c2",
                        "topic": "booking.approval",
                        "value": "owner approves via WhatsApp",
                        "stance": "revise",
                        "revises": "c1",
                        "span": {"start": 40, "end": 80},
                        "lang": "hi-Latn",
                    },
                ]
            })

        if schema is GapAnalysisResult:
            return schema.model_validate({
                "assumptions": [
                    {
                        "id": "A1",
                        "statement": "Clinic operates on single timezone",
                        "risk": "low",
                        "status": "open",
                    }
                ],
                "questions": [
                    {
                        "id": "Q1",
                        "text": "Will appointments require patient prepayment?",
                        "why_it_matters": "Determines payment gateway integration scope.",
                        "impact": 5,
                        "options": ["Pay at clinic", "Stripe payment", "UPI link"],
                    }
                ],
            })

        if schema is Spec:
            return DEFAULT_SPEC  # type: ignore[return-value]

        # Generic Pydantic fallback if fixture is a dict
        if "default" in self.fixtures:
            return schema.model_validate(self.fixtures["default"])

        raise ValueError(f"No fixture registered for schema {schema.__name__} (hash={input_hash})")
