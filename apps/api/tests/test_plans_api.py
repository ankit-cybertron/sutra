"""Test Plans API endpoints (details, chat, markdown export, deletion)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_plans_api(client: AsyncClient):
    headers = {"X-Device-Id": "device-plan-tester"}

    # 1. Setup session and plan
    create_res = await client.post(
        "/api/sessions",
        json={"idea": "AI habit tracker with daily WhatsApp voice notes"},
        headers=headers,
    )
    session_id = create_res.json()["sessionId"]

    plan_res = await client.post(
        f"/api/sessions/{session_id}/plan",
        json={"answers": []},
        headers=headers,
    )
    plan_id = plan_res.json()["id"]

    # 2. Get plan detail
    detail_res = await client.get(f"/api/plans/{plan_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == plan_id
    assert detail["version"] == 1
    assert "plan" in detail

    # 3. Chat refinement
    chat_res = await client.post(
        f"/api/plans/{plan_id}/chat",
        json={"message": "dark mode bhi add karo", "source": "voice", "lang": "auto"},
        headers=headers,
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert chat_data["plan"]["version"] == 2
    assert len(chat_data["changeSummary"]) > 0

    # 4. Export markdown
    export_res = await client.get(f"/api/plans/{plan_id}/export.md", headers=headers)
    assert export_res.status_code == 200
    assert "text/markdown" in export_res.headers["content-type"]
    assert "# " in export_res.text

    # 5. Delete plan
    del_res = await client.delete(f"/api/plans/{plan_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

    # Confirm 404 after deletion
    not_found_res = await client.get(f"/api/plans/{plan_id}", headers=headers)
    assert not_found_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_all_data(client: AsyncClient):
    headers = {"X-Device-Id": "device-clean-tester"}

    # Create session
    await client.post(
        "/api/sessions",
        json={"idea": "Temporary idea to be wiped"},
        headers=headers,
    )

    del_data_res = await client.delete("/api/data", headers=headers)
    assert del_data_res.status_code == 200
    data = del_data_res.json()
    assert data["ok"] is True
