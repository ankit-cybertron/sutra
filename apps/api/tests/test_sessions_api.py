"""Test Sessions API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_session_lifecycle(client: AsyncClient):
    headers = {"X-Device-Id": "test-device-uuid"}

    # 1. Create Session
    create_res = await client.post(
        "/api/sessions",
        json={"idea": "I want an app that turns Hinglish voice into coding blueprints", "source": "voice"},
        headers=headers,
    )
    assert create_res.status_code == 200
    create_data = create_res.json()
    assert "session_id" in create_data
    session_id = create_data["session_id"]
    assert len(create_data["questions"]) <= 2

    # 2. Submit Answers
    answers_payload = {
        "answers": [
            {"question_id": "q1", "text": "For solo developers and indie hackers"},
            {"question_id": "q2", "text": "Web application"},
        ]
    }
    ans_res = await client.post(
        f"/api/sessions/{session_id}/answers",
        json=answers_payload,
        headers=headers,
    )
    assert ans_res.status_code == 200
    assert ans_res.json()["ready"] is True

    # 3. Generate Plan
    plan_res = await client.post(
        f"/api/sessions/{session_id}/plan",
        headers=headers,
    )
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert "plan_id" in plan_data
    assert plan_data["plan"]["title"]
    assert len(plan_data["plan"]["must_have"]) <= 5
