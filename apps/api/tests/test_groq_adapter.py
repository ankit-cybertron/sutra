"""Test Groq LLM Adapter."""

import pytest
from apps.api.app.adapters.groq import GroqAdapter
from apps.api.app.schemas import Answer


@pytest.mark.asyncio
async def test_groq_clarify_fallback():
    groq = GroqAdapter(api_key="")
    res = await groq.clarify("Ek Hinglish voice app banana hai jo plan banaye", lang="auto")
    assert res.detected_language in ["hinglish", "hi"]
    assert len(res.questions) <= 2
    assert len(res.questions) > 0


@pytest.mark.asyncio
async def test_groq_plan_fallback():
    groq = GroqAdapter(api_key="")
    answers = [Answer(question_id="q1", text="Solo builders")]
    plan = await groq.plan("Voice to plan app", answers, lang="en")
    assert plan.title
    assert len(plan.must_have) <= 5
    assert len(plan.suggestions) == 3
    assert "Do not build" in plan.first_prompt


@pytest.mark.asyncio
async def test_groq_refine_fallback():
    groq = GroqAdapter(api_key="")
    answers = [Answer(question_id="q1", text="Solo builders")]
    plan = await groq.plan("Voice to plan app", answers, lang="en")
    refine_res = await groq.refine(plan, "dark mode bhi add karo", lang="en")
    assert len(refine_res.change_summary) > 0
    assert "dark mode" in refine_res.plan.tech_notes.lower()
