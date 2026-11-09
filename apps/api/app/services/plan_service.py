"""Service managing plans, version increments, refinements, and Markdown exports."""

import time
import uuid
from typing import Dict, List, Optional, Tuple

from apps.api.app.adapters import get_groq_adapter
from apps.api.app.errors import ApiProblemError
from apps.api.app.schemas import (
    Plan,
    PlanDoc,
    PlanSummary,
    PlanVersion,
)
from apps.api.app.services.session_service import SessionService
from apps.api.app.store import get_store


class PlanService:
    @property
    def store(self):
        return get_store()

    @property
    def groq(self):
        return get_groq_adapter()

    @property
    def session_service(self):
        return SessionService()

    async def generate_plan(self, device_id: str, session_id: str) -> Tuple[PlanDoc, Plan]:
        session = await self.session_service.get_session(device_id, session_id)

        plan = await self.groq.plan(
            idea=session.idea_raw,
            answers=session.answers,
            lang=session.idea_lang,
        )

        plan_id = f"pln_{uuid.uuid4().hex[:10]}"
        now = time.time()
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))

        initial_version = PlanVersion(
            n=1,
            plan=plan,
            change_summary=["Initial structured plan synthesized from idea & answers."],
            created_at=now_iso,
            source="generate",
        )

        plan_doc = PlanDoc(
            id=plan_id,
            device_id=device_id,
            session_id=session_id,
            title=plan.title,
            versions=[initial_version],
            created_at=now_iso,
            updated_at=now_iso,
        )

        await self.store.put("plans", plan_doc.model_dump())

        # Update session status
        session.status = "completed"
        await self.store.put("sessions", session.model_dump())

        return plan_doc, plan

    async def refine_plan(
        self,
        device_id: str,
        plan_id: str,
        suggestion: str,
        source: str = "text",
    ) -> Tuple[PlanDoc, int, Plan, List[str]]:
        plan_doc = await self.get_plan(device_id, plan_id)
        current_version = plan_doc.versions[-1]

        # Call Groq refine
        refine_res = await self.groq.refine(
            current_plan=current_version.plan,
            suggestion=suggestion,
            lang=current_version.plan.language,
        )

        now = time.time()
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
        new_version_num = len(plan_doc.versions) + 1

        new_version = PlanVersion(
            n=new_version_num,
            plan=refine_res.plan,
            change_summary=refine_res.change_summary,
            created_at=now_iso,
            source="suggestion",
        )

        plan_doc.versions.append(new_version)
        plan_doc.title = refine_res.plan.title
        plan_doc.updated_at = now_iso

        await self.store.put("plans", plan_doc.model_dump())
        return plan_doc, new_version_num, refine_res.plan, refine_res.change_summary

    async def get_plan(self, device_id: str, plan_id: str) -> PlanDoc:
        doc = await self.store.get("plans", plan_id)
        if not doc or doc.get("device_id") != device_id:
            raise ApiProblemError(
                status_code=404,
                code="PLAN_NOT_FOUND",
                title="Plan Not Found",
                detail=f"Plan '{plan_id}' does not exist for this device.",
            )
        return PlanDoc.model_validate(doc)

    async def list_plans(self, device_id: str) -> List[PlanSummary]:
        docs = await self.store.list(
            "plans",
            filter_fn=lambda d: d.get("device_id") == device_id,
            sort_key="updated_at",
            reverse=True,
        )

        summaries: List[PlanSummary] = []
        for d in docs:
            versions = d.get("versions", [])
            latest_n = versions[-1]["n"] if versions else 1
            summaries.append(
                PlanSummary(
                    id=d["id"],
                    session_id=d.get("session_id", ""),
                    title=d.get("title", "Untitled Plan"),
                    versions_count=len(versions),
                    latest_version=latest_n,
                    created_at=d.get("created_at", ""),
                    updated_at=d.get("updated_at", ""),
                )
            )
        return summaries

    async def delete_plan(self, device_id: str, plan_id: str) -> bool:
        # Verify ownership
        await self.get_plan(device_id, plan_id)
        return await self.store.delete("plans", plan_id)

    async def delete_all_user_data(self, device_id: str) -> Dict[str, int]:
        # Delete plans
        plans = await self.store.list(
            "plans", filter_fn=lambda d: d.get("device_id") == device_id
        )
        deleted_plans = 0
        for p in plans:
            if await self.store.delete("plans", p["id"]):
                deleted_plans += 1

        # Delete sessions
        sessions = await self.store.list(
            "sessions", filter_fn=lambda d: d.get("device_id") == device_id
        )
        deleted_sessions = 0
        for s in sessions:
            if await self.store.delete("sessions", s["id"]):
                deleted_sessions += 1

        return {
            "deleted_plans": deleted_plans,
            "deleted_sessions": deleted_sessions,
        }

    async def export_markdown(self, device_id: str, plan_id: str) -> str:
        plan_doc = await self.get_plan(device_id, plan_id)
        latest_version = plan_doc.versions[-1]
        p = latest_version.plan

        must_haves_md = ""
        for i, m in enumerate(p.must_have, 1):
            must_haves_md += f"### {i}. {m.name}\n"
            must_haves_md += f"**Why:** {m.why}\n\n"
            must_haves_md += "**Acceptance Criteria:**\n"
            for acc in m.acceptance:
                must_haves_md += f"- [ ] {acc}\n"
            must_haves_md += "\n"

        build_order_md = ""
        for b in p.build_order:
            build_order_md += f"{b.step}. **{b.title}**: {b.detail}\n"

        later_md = "\n".join([f"- {item}" for item in p.later]) or "- None"
        out_of_scope_md = "\n".join([f"- {item}" for item in p.out_of_scope]) or "- None"
        risks_md = "\n".join([f"- {r}" for r in p.risks]) or "- None"
        assumptions_md = "\n".join([f"- {a}" for a in p.assumptions]) or "- None"
        open_questions_md = "\n".join([f"- {q}" for q in p.open_questions]) or "- None"

        md = f"""# {p.title}
*Version {latest_version.n} · Generated by Sutra*

> **{p.one_liner}**

---

## Overview
- **Target User:** {p.target_user}
- **Problem Statement:** {p.problem}
- **Language / Locale:** {p.language}

---

## Must-Have Capabilities (Vertical Slice MVP)
{must_haves_md}

---

## Build Order
{build_order_md}

---

## Technical Notes & Architecture
{p.tech_notes}

---

## Scope Boundaries
### Later (v2 Backlog)
{later_md}

### Out of Scope (Explicitly Not Building)
{out_of_scope_md}

---

## Risks & Assumptions
### Key Risks
{risks_md}

### Assumptions
{assumptions_md}

### Open Questions
{open_questions_md}

---

## First Prompt for Coding Agent (Claude Code / Cursor)
```markdown
{p.first_prompt}
```
"""
        return md.strip()
