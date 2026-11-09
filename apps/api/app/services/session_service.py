"""Service orchestrating idea sessions, clarification turns, and answers."""

import time
import uuid
from typing import List, Tuple

from apps.api.app.adapters import get_groq_adapter
from apps.api.app.errors import ApiProblemError
from apps.api.app.schemas import (
    Answer,
    ClarifyQuestion,
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
        lang: str = "auto",
        source: str = "text",
    ) -> Tuple[SessionDoc, List[ClarifyQuestion]]:
        session_id = f"ses_{uuid.uuid4().hex[:12]}"
        now = time.time()
        created_at_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))

        initial_turn = Turn(
            role="user",
            text=idea,
            source="voice" if source == "voice" else "text",
            lang=lang,
            ts=now,
        )

        # Call Groq to clarify
        clarify_res = await self.groq.clarify(idea, lang)
        questions = clarify_res.questions

        status = "clarifying" if questions else "ready_for_plan"

        session = SessionDoc(
            id=session_id,
            device_id=device_id,
            idea_raw=idea,
            idea_lang=clarify_res.detected_language or lang,
            turns=[initial_turn],
            questions=questions,
            answers=[],
            status=status,
            created_at=created_at_iso,
        )

        await self.store.put("sessions", session.model_dump())
        return session, questions

    async def get_session(self, device_id: str, session_id: str) -> SessionDoc:
        doc = await self.store.get("sessions", session_id)
        if not doc or doc.get("device_id") != device_id:
            raise ApiProblemError(
                status_code=404,
                code="SESSION_NOT_FOUND",
                title="Session Not Found",
                detail=f"No active session found with id '{session_id}' for this device.",
            )
        return SessionDoc.model_validate(doc)

    async def submit_answers(
        self,
        device_id: str,
        session_id: str,
        answers: List[Answer],
    ) -> SessionDoc:
        session = await self.get_session(device_id, session_id)
        now = time.time()

        for a in answers:
            session.answers.append(a)
            session.turns.append(
                Turn(
                    role="user",
                    text=f"[Answer to {a.question_id}]: {a.text}",
                    source="text",
                    lang=session.idea_lang,
                    ts=now,
                )
            )

        session.status = "ready_for_plan"
        await self.store.put("sessions", session.model_dump())
        return session
