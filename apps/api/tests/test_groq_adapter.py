"""Test Groq LLM Adapter."""

import pytest
from apps.api.app.adapters.groq import GroqAdapter
from apps.api.app.schemas import AnswerInput


@pytest.mark.asyncio
async def test_groq_clarify_fallback():
    groq = GroqAdapter(api_key="")
    detected_lang, questions = await groq.clarify("Ek Hinglish voice app banana hai jo plan banaye", lang="auto")
    assert detected_lang in ["hinglish", "hi"]
    assert len(questions) <= 2
    assert len(questions) > 0


@pytest.mark.asyncio
async def test_groq_plan_fallback():
    groq = GroqAdapter(api_key="")
    answers = [AnswerInput(question_id="q1", text="Solo builders")]
    plan = await groq.plan("Voice to plan app", answers, lang="en")
    assert plan.title
    assert len(plan.must_have) <= 5
    assert len(plan.suggestions) == 3
    assert "Do not build" in plan.first_prompt


@pytest.mark.asyncio
async def test_groq_chat_fallback():
    groq = GroqAdapter(api_key="")
    answers = [AnswerInput(question_id="q1", text="Solo builders")]
    plan = await groq.plan("Voice to plan app", answers, lang="en")
    reply, spoken, updated_plan, change_summary = await groq.chat(plan, "dark mode bhi add karo", [], lang="en")
    assert len(change_summary) > 0
    assert updated_plan is not None
    assert "dark mode" in updated_plan.tech_notes.lower()
