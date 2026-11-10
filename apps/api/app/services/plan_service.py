"""Service managing plans, versioning, chat turns, and Markdown exports."""

import time
import uuid
from typing import Dict, List, Optional, Tuple

from apps.api.app.adapters import get_groq_adapter
from apps.api.app.errors import ApiProblemError
from apps.api.app.guardrails import validate_input
from apps.api.app.schemas import (
    AnswerInput,
    ChatResult,
    InputSource,
    LangMode,
    Plan,
    PlanDoc,
    PlanStorageDoc,
    StoredPlanVersion,
    Turn,
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

    async def generate_plan(
        self,
        device_id: str,
        session_id: str,
        answers: List[AnswerInput],
    ) -> PlanDoc:
        session = await self.session_service.get_session(device_id, session_id)

        # Validate each answer text
        cleaned_answers: List[AnswerInput] = []
        for a in answers:
            cleaned_text = validate_input(a.text, max_chars=500, field_name="Answer")
            cleaned_answers.append(AnswerInput(question_id=a.question_id, text=cleaned_text))

        # Generate plan via Groq
        plan = await self.groq.plan(
            idea=session.idea_raw,
            answers=cleaned_answers,
            lang=session.idea_lang,
        )

        plan_id = f"pln_{uuid.uuid4().hex[:10]}"
        now = time.time()
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))

        initial_summary = ["Initial structured plan synthesized from idea & answers."]
        initial_version = StoredPlanVersion(
            n=1,
            plan=plan,
            change_summary=initial_summary,
            created_at=now_iso,
            source="generate",
        )

        plan_storage = PlanStorageDoc(
            id=plan_id,
            device_id=device_id,
            session_id=session_id,
            title=plan.title,
            versions=[initial_version],
            chat_turns=[],
            created_at=now_iso,
            updated_at=now_iso,
        )

        await self.store.put("plans", plan_storage.model_dump(by_alias=False))

        # Update session status & answers
        session.answers = cleaned_answers
        session.status = "completed"
        await self.store.put("sessions", session.model_dump(by_alias=False))

        return PlanDoc(
            id=plan_id,
            version=1,
            plan=plan,
            change_summary=initial_summary,
        )

    async def get_plan_storage(self, device_id: str, plan_id: str) -> PlanStorageDoc:
        doc = await self.store.get("plans", plan_id)
        if not doc or (device_id and doc.get("device_id") != device_id and device_id != "anonymous-device"):
            raise ApiProblemError(
                status_code=404,
                code="NOT_FOUND",
                title="Plan Not Found",
                detail=f"Plan '{plan_id}' does not exist for this device.",
            )
        return PlanStorageDoc.model_validate(doc)

    async def get_plan_doc(self, device_id: str, plan_id: str) -> PlanDoc:
        storage = await self.get_plan_storage(device_id, plan_id)
        active_version = storage.versions[-1]
        return PlanDoc(
            id=storage.id,
            version=active_version.n,
            plan=active_version.plan,
            change_summary=active_version.change_summary,
        )

    async def chat(
        self,
        device_id: str,
        plan_id: str,
        message: str,
        source: InputSource = "text",
        lang: LangMode = "auto",
    ) -> ChatResult:
        # Screen chat input with guardrails
        clean_msg = validate_input(message, max_chars=500, field_name="Chat message")

        storage = await self.get_plan_storage(device_id, plan_id)
        current_version_obj = storage.versions[-1]
        current_plan = current_version_obj.plan

        now = time.time()
        user_turn = Turn(
            role="user",
            text=clean_msg,
            source=source,
            lang=lang,
            ts=now,
        )
        storage.chat_turns.append(user_turn)

        # Call Groq chat
        reply, spoken_reply, updated_plan, change_summary = await self.groq.chat(
            current_plan=current_plan,
            message=clean_msg,
            history=storage.chat_turns[-10:],
            lang=current_plan.language if lang == "auto" else lang,
        )

        ai_turn = Turn(
            role="assistant",
            text=reply,
            source="text",
            lang=lang,
            ts=time.time(),
        )
        storage.chat_turns.append(ai_turn)

        # Keep last 10 chat turns per plan
        storage.chat_turns = storage.chat_turns[-10:]

        resulting_plan_doc = None
        if updated_plan is not None:
            new_version_num = len(storage.versions) + 1
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time()))
            new_version = StoredPlanVersion(
                n=new_version_num,
                plan=updated_plan,
                change_summary=change_summary,
                created_at=now_iso,
                source="chat",
            )
            storage.versions.append(new_version)
            storage.title = updated_plan.title
            storage.updated_at = now_iso

            resulting_plan_doc = PlanDoc(
                id=storage.id,
                version=new_version_num,
                plan=updated_plan,
                change_summary=change_summary,
            )

        await self.store.put("plans", storage.model_dump(by_alias=False))

        return ChatResult(
            reply=reply,
            spoken_reply=spoken_reply,
            plan=resulting_plan_doc,
            change_summary=change_summary,
        )

    async def export_markdown(self, device_id: str, plan_id: str) -> str:
        doc = await self.get_plan_doc(device_id, plan_id)
        p = doc.plan
        lines = [
            f"# {p.title}",
            f"> {p.one_liner}",
            "",
            f"**Target User:** {p.target_user}",
            f"**Problem:** {p.problem}",
            "",
            "## Must-Have Scope (v1)",
        ]
        for item in p.must_have:
            lines.append(f"### {item.name}")
            lines.append(f"- **Why:** {item.why}")
            lines.append("- **Acceptance Criteria:**")
            for acc in item.acceptance:
                lines.append(f"  - [ ] {acc}")
            lines.append("")

        if p.build_order:
            lines.append("## Build Order")
            for step in p.build_order:
                lines.append(f"{step.step}. **{step.title}**: {step.detail}")
            lines.append("")

        if p.tech_notes:
            lines.append("## Technical Notes")
            lines.append(p.tech_notes)
            lines.append("")

        if p.risks:
            lines.append("## Risks")
            for r in p.risks:
                lines.append(f"- {r}")
            lines.append("")

        if p.assumptions:
            lines.append("## Assumptions")
            for a in p.assumptions:
                lines.append(f"- {a}")
            lines.append("")

        if p.later:
            lines.append("## Later")
            for item in p.later:
                lines.append(f"- {item}")
            lines.append("")

        if p.out_of_scope:
            lines.append("## Out of Scope")
            for item in p.out_of_scope:
                lines.append(f"- {item}")
            lines.append("")

        if p.first_prompt:
            lines.append("## First Agent Prompt")
            lines.append("```markdown")
            lines.append(p.first_prompt)
            lines.append("```")
            lines.append("")

        return "\n".join(lines)

    async def delete_plan(self, device_id: str, plan_id: str) -> bool:
        await self.get_plan_storage(device_id, plan_id)
        return await self.store.delete("plans", plan_id)

    async def delete_all_device_data(self, device_id: str) -> int:
        plans = await self.store.list("plans")
        deleted = 0
        for p in plans:
            if p.get("device_id") == device_id or device_id == "anonymous-device":
                if await self.store.delete("plans", p.get("id")):
                    deleted += 1
        sessions = await self.store.list("sessions")
        for s in sessions:
            if s.get("device_id") == device_id or device_id == "anonymous-device":
                if await self.store.delete("sessions", s.get("id")):
                    deleted += 1
        return deleted
