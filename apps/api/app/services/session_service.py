"""Service orchestrating idea sessions, clarification turns, and answers."""

import time
import uuid
from typing import List, Tuple

from apps.api.app.adapters import get_groq_adapter
from apps.api.app.errors import ApiProblemError
from apps.api.app.guardrails import validate_input
from apps.api.app.schemas import (
    AnswerInput,
    Lang,
    LangMode,
    Question,
    SessionDoc,
    Turn,
)
from apps.api.app.store import get_store


class SessionService:
    @property
    def store(self):
        return get_store()

    @property
    def groq(self):
        return get_groq_adapter()

    async def create_session(
        self,
        device_id: str,
        idea: str,
        lang: LangMode = "auto",
        source: str = "text",
    ) -> Tuple[str, Lang, List[Question]]:
        # Guardrail normalization and injection screening
        clean_idea = validate_input(idea, max_chars=1500, field_name="Idea")

        session_id = f"ses_{uuid.uuid4().hex[:12]}"
        now = time.time()
        created_at_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))

        initial_turn = Turn(
            role="user",
            text=clean_idea,
            source="voice" if source == "voice" else "text",
            lang=lang,
            ts=now,
        )

        # Call Groq clarify
        detected_lang, questions = await self.groq.clarify(clean_idea, lang=lang)

        status = "clarifying" if questions else "ready_for_plan"

        session = SessionDoc(
            id=session_id,
            device_id=device_id,
            idea_raw=clean_idea,
            idea_lang=detected_lang,
            turns=[initial_turn],
            questions=questions,
            answers=[],
            status=status,
            created_at=created_at_iso,
        )

        await self.store.put("sessions", session.model_dump(by_alias=False))
        return session_id, detected_lang, questions

    async def get_session(self, device_id: str, session_id: str) -> SessionDoc:
        doc = await self.store.get("sessions", session_id)
        if not doc or (device_id and doc.get("device_id") != device_id and device_id != "anonymous-device"):
            raise ApiProblemError(
                status_code=404,
                code="NOT_FOUND",
                title="Session Not Found",
                detail=f"No active session found with id '{session_id}'.",
            )
        return SessionDoc.model_validate(doc)
