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
    assert "sessionId" in create_data
    session_id = create_data["sessionId"]
    assert len(create_data["questions"]) <= 2

    # 2. Generate Plan directly with answers
    plan_res = await client.post(
        f"/api/sessions/{session_id}/plan",
        json={
            "answers": [
                {"questionId": "q1", "text": "For solo developers and indie hackers"},
                {"questionId": "q2", "text": "Web application"},
            ]
        },
        headers=headers,
    )
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert "id" in plan_data
    assert plan_data["plan"]["title"]
    assert len(plan_data["plan"]["mustHave"]) <= 5
