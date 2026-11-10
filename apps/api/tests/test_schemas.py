"""Test Pydantic schemas and validation invariants."""

import pytest
from apps.api.app.schemas import (
    BuildStep,
    CreateSessionResult,
    MustHave,
    Plan,
    Question,
    Suggestion,
)


def test_clarify_result_caps_questions_at_two():
    questions = [
        Question(id=f"q{i}", display_text=f"Q{i}", spoken_text=f"Q{i}", options=[])
        for i in range(5)
    ]
    res = CreateSessionResult(
        session_id="ses_123",
        detected_lang="en",
        questions=questions,
    )
    assert len(res.questions) == 2
    assert res.questions[0].id == "q0"
    assert res.questions[1].id == "q1"


def test_plan_caps_must_have_at_five():
    must_haves = [
        MustHave(name=f"F{i}", why=f"Why {i}", acceptance=[f"Acc {i}"])
        for i in range(8)
    ]
    plan = Plan(
        title="Test Title",
        one_liner="Test one liner",
        target_user="Developers",
        problem="Slow setup",
        must_have=must_haves,
        later=[],
        out_of_scope=[],
        build_order=[BuildStep(step=1, title="S1", detail="D1")],
        tech_notes="FastAPI",
        risks=[],
        assumptions=[],
        open_questions=[],
        suggestions=[Suggestion(id=f"s{i}", text=f"S{i}", impact="medium") for i in range(3)],
        first_prompt="Build it",
        language="en",
    )
    assert len(plan.must_have) == 5
