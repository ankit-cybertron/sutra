"""Test Plans API endpoints (listing, details, refining, markdown export, deletion)."""

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
    session_id = create_res.json()["session_id"]

    plan_res = await client.post(
        f"/api/sessions/{session_id}/plan",
        headers=headers,
    )
    plan_id = plan_res.json()["plan_id"]

    # 2. List plans
    list_res = await client.get("/api/plans", headers=headers)
    assert list_res.status_code == 200
    plans = list_res.json()["plans"]
    assert len(plans) == 1
    assert plans[0]["id"] == plan_id

    # 3. Get plan detail
    detail_res = await client.get(f"/api/plans/{plan_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == plan_id
    assert detail["current_version"] == 1
    assert len(detail["versions"]) == 1

    # 4. Refine plan
    refine_res = await client.post(
        f"/api/plans/{plan_id}/refine",
        json={"suggestion": "dark mode bhi add karo", "source": "voice"},
        headers=headers,
    )
    assert refine_res.status_code == 200
    refine_data = refine_res.json()
    assert refine_data["version"] == 2
    assert len(refine_data["change_summary"]) > 0

    # 5. Export markdown
    export_res = await client.get(f"/api/plans/{plan_id}/export.md", headers=headers)
    assert export_res.status_code == 200
    assert "text/markdown" in export_res.headers["content-type"]
    assert "# " in export_res.text
    assert "First Prompt for Coding Agent" in export_res.text

    # 6. Delete plan
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
    assert data["deleted_sessions"] >= 1
