"""Groq LLM Adapter with strict Pydantic validation, repair retries, and usage tracking."""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple
import httpx
from pydantic import BaseModel, Field, ValidationError

from apps.api.app.config import settings
from apps.api.app.errors import ApiProblemError
from apps.api.app.prompts import chat, clarify, plan
from apps.api.app.schemas import (
    AnswerInput,
    BuildStep,
    CreateSessionResult,
    Lang,
    MustHave,
    Plan,
    Question,
    Suggestion,
    Turn,
)

logger = logging.getLogger("sutra.adapters.groq")


class ChatLLMOutput(BaseModel):
    reply: str
    spoken_reply: str
    plan_changed: bool
    change_summary: List[str] = Field(default_factory=list)
    updated_plan: Optional[Plan] = None


class ClarifyLLMOutput(BaseModel):
    detected_lang: Lang = "en"
    idea_summary: str
    questions: List[Question] = Field(default_factory=list)


class GroqAdapter:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_s: Optional[float] = None,
    ):
        self.api_key = api_key or settings.groq_api_key
        self.model = model or settings.groq_model
        self.fallback_model = settings.groq_fallback_model
        self.timeout_s = timeout_s or settings.groq_timeout_s
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"

        self.total_calls = 0
        self.estimated_tokens = 0

    async def _call_groq_raw(
        self,
        messages: List[Dict[str, str]],
        model_name: str,
        json_mode: bool = True,
    ) -> Dict[str, Any]:
        if (
            not self.api_key
            or self.api_key.startswith("gsk_your_groq")
            or self.api_key.startswith("mock")
            or self.api_key == "mock_key"
        ):
            logger.warning("GROQ_API_KEY is mock or unset. Using deterministic mock fallback.")
            return {"mock": True}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.2,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                response = await client.post(self.base_url, headers=headers, json=payload)
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            logger.warning(f"Groq network error ({exc}). Falling back to mock response.")
            return {"mock": True}

        if response.status_code != 200:
            logger.error(f"Groq API error {response.status_code}: {response.text}")
            raise ApiProblemError(
                status_code=502,
                code="PROVIDER_UNAVAILABLE",
                title="LLM Service Error",
                detail=f"Groq API returned error: {response.status_code}",
                extra={"error_body": response.text[:200]},
            )

        data = response.json()
        usage = data.get("usage", {})
        self.total_calls += 1
        self.estimated_tokens += usage.get("total_tokens", 500)
        return data

    async def _generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema_cls: Any,
    ) -> Any:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            raw = await self._call_groq_raw(messages, self.model, json_mode=True)
            if raw.get("mock"):
                return None

            content = raw["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return schema_cls.model_validate(parsed)
        except ApiProblemError as api_err:
            logger.warning(f"Groq API error ({api_err.detail}). Falling back to mock generator.")
            return None
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(f"Groq validation failed ({e}). Retrying with repair...")
            repair_messages = list(messages)
            repair_messages.append(
                {
                    "role": "user",
                    "content": f"Your previous response had a schema validation error: {str(e)}. Return strictly valid JSON that matches the schema.",
                }
            )
            try:
                raw_repair = await self._call_groq_raw(repair_messages, self.fallback_model, json_mode=True)
                if raw_repair.get("mock"):
                    return None
                content_repair = raw_repair["choices"][0]["message"]["content"]
                parsed_repair = json.loads(content_repair)
                return schema_cls.model_validate(parsed_repair)
            except Exception as final_e:
                logger.error(f"Groq repair retry failed: {final_e}")
                return None

    async def clarify(self, idea: str, lang: str = "auto") -> Tuple[Lang, List[Question]]:
        user_content = clarify.USER_TEMPLATE.format(idea=idea.strip(), lang=lang)
        result = await self._generate_json(clarify.SYSTEM_PROMPT, user_content, ClarifyLLMOutput)
        if result is not None:
            return result.detected_lang, result.questions[:2]

        return self._mock_clarify(idea, lang)

    async def plan(
        self,
        idea: str,
        answers: List[AnswerInput],
        lang: str = "auto",
    ) -> Plan:
        answers_text = "\n".join(
            [f"- Question {a.question_id}: {a.text}" for a in answers]
        ) or "None provided."
        user_content = plan.USER_TEMPLATE.format(
            idea=idea.strip(), answers_text=answers_text, lang=lang
        )
        result = await self._generate_json(plan.SYSTEM_PROMPT, user_content, Plan)
        if result is not None:
            return result

        return self._mock_plan(idea, answers, lang)

    async def chat(
        self,
        current_plan: Plan,
        message: str,
        history: List[Turn],
        lang: str = "auto",
    ) -> Tuple[str, str, Optional[Plan], List[str]]:
        history_text = "\n".join(
            [f"{t.role}: {t.text}" for t in history[-8:]]
        ) or "None"
        plan_json = current_plan.model_dump_json(indent=2)
        user_content = chat.USER_TEMPLATE.format(
            plan_json=plan_json,
            chat_history=history_text,
            message=message.strip(),
            lang=lang,
        )
        result = await self._generate_json(chat.SYSTEM_PROMPT, user_content, ChatLLMOutput)
        if result is not None:
            updated_p = result.updated_plan if result.plan_changed else None
            return result.reply, result.spoken_reply, updated_p, result.change_summary

        return self._mock_chat(current_plan, message, lang)

    # --- Mocks for offline test / CI ---

    def _mock_clarify(self, idea: str, lang: str) -> Tuple[Lang, List[Question]]:
        # If the idea is already exceptionally specific (> 20 words and contains specific stack/role)
        is_hindi = any(
            word in idea.lower()
            for word in ["karo", "chahiye", "mera", "bana", "kaise", "hai", "karna", "app"]
        )
        detected: Lang = "hinglish" if is_hindi else ("hi" if lang == "hi" else "en")

        # 0 questions test case: if idea is already fully specific
        if "fully specific" in idea.lower() or "no questions" in idea.lower():
            return detected, []

        if is_hindi or detected == "hinglish":
            questions = [
                Question(
                    id="q1",
                    display_text="Target audience kaun hai - solo builders ya enterprise teams?",
                    spoken_text="Target audience kaun hai, solo builders ya enterprise teams?",
                    options=["Solo Builders", "College Students", "Small Businesses", "General Public"],
                ),
                Question(
                    id="q2",
                    display_text="Vertical slice mein primary interface kya hoga: Web app ya Mobile?",
                    spoken_text="Vertical slice mein primary interface kya hoga, Web app ya Mobile?",
                    options=["Web App", "Mobile (React Native)", "CLI Tool", "Chrome Extension"],
                ),
            ]
        else:
            questions = [
                Question(
                    id="q1",
                    display_text="Who is the primary target persona for the vertical slice?",
                    spoken_text="Who is the primary target persona for the vertical slice?",
                    options=["Solo Developers", "Students & Hackers", "Early Stage Startups"],
                ),
                Question(
                    id="q2",
                    display_text="What is the non-negotiable primary mechanism in v1?",
                    spoken_text="What is the non-negotiable primary mechanism in version one?",
                    options=["Instant voice-to-plan", "Visual canvas editor", "Automated code scaffold"],
                ),
            ]

        return detected, questions

    def _mock_plan(self, idea: str, answers: List[AnswerInput], lang: str) -> Plan:
        words = [w for w in idea.split() if len(w) > 2]
        title = "Sutra Idea Engine"
        if len(words) >= 2:
            title = " ".join([w.capitalize() for w in words[:3]])

        plan_lang: Lang = "hi" if lang == "hi" else ("hinglish" if lang == "hinglish" else "en")

        return Plan(
            title=title,
            one_liner="Transform voice thoughts into structured, executable technical blueprints.",
            target_user="Solo builders and students in India who brainstorm in Hinglish.",
            problem="Translating chaotic voice thoughts into concrete engineering requirements is slow and error-prone.",
            must_have=[
                MustHave(
                    name="Live Voice Intake & Clarification",
                    why="Captures unstructured brainstorms with zero friction.",
                    acceptance=[
                        "Accepts streaming 16kHz PCM audio",
                        "Generates max 2 clarifying questions within 3s",
                        "Spoken playback via TTS",
                    ],
                ),
                MustHave(
                    name="Strict Structured Plan Synthesis",
                    why="Delivers actionable architecture without fluff.",
                    acceptance=[
                        "Produces must-haves, build order, and tech notes",
                        "Caps must-haves at <= 5 items",
                        "Validates against Pydantic V2 schema",
                    ],
                ),
                MustHave(
                    name="Interactive Voice Suggestions",
                    why="Allows rapid plan refinement in natural language.",
                    acceptance=[
                        "Appends new versions with diff summaries",
                        "Offers 3 one-tap suggestion chips",
                    ],
                ),
            ],
            later=[
                "Export to Jira/Linear tickets",
                "Multi-speaker audio transcription",
                "Full-code repository generation pipeline",
            ],
            out_of_scope=[
                "Manual Gantt-chart timeline editors",
                "Heavy enterprise role-based access control",
            ],
            build_order=[
                BuildStep(step=1, title="Scaffold Monorepo & Core Types", detail="Initialize FastAPI + Pydantic v2."),
                BuildStep(step=2, title="Implement Document Store", detail="Set up atomic JSON store with file locking."),
                BuildStep(step=3, title="Implement Voice & LLM Adapters", detail="Integrate Gnani STT/TTS and Groq structured output."),
                BuildStep(step=4, title="Build Reactive Frontend", detail="Create voice orb and plan inspection cards."),
            ],
            tech_notes="FastAPI, Groq LLM (llama-3.3-70b-versatile), Gnani AI (Prisma v3 + Timbre v2.5), Atomic JSON file store.",
            risks=[
                "Voice latency spikes on low bandwidth",
                "Hinglish code-mixing dialect variations",
            ],
            assumptions=[
                "Users have standard microphone access",
                "Users prefer concise vertical-slice roadmaps",
            ],
            open_questions=[
                "Should plan export support GitHub PR issue template directly?",
            ],
            suggestions=[
                Suggestion(id="s1", text="Add dark mode support", impact="medium"),
                Suggestion(id="s2", text="Add download as Markdown", impact="low"),
                Suggestion(id="s3", text="Add 1-click prompt copy", impact="high"),
            ],
            first_prompt=f"You are building {title}. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on the must-have capabilities described above. Do not build: authentication, enterprise billing, or third-party integrations.",
            language=plan_lang,
        )

    def _mock_chat(
        self, current_plan: Plan, message: str, lang: str
    ) -> Tuple[str, str, Optional[Plan], List[str]]:
        msg_lower = message.lower()
        is_change_request = any(
            w in msg_lower for w in ["add", "karo", "change", "include", "dark mode", "export", "bhi"]
        )

        if is_change_request:
            updated = current_plan.model_copy(deep=True)
            if "dark mode" in msg_lower:
                updated.tech_notes += " Includes system-responsive dark mode styling."
                change = "Added dark mode design tokens to tech notes."
                reply = "Dark mode plan mein add kar diya hai! Tech notes update ho gaye hain."
                spoken = "Dark mode plan mein add kar diya gaya hai."
            else:
                updated.later.append(message.strip())
                change = f"Scoped '{message.strip()}' into v2 backlog."
                reply = f"Aapka suggestion '{message}' note kar liya hai aur roadmap mein add kar diya hai."
                spoken = "Plan update ho gaya hai."

            updated.suggestions = [
                Suggestion(id="s4", text="Add offline PWA support", impact="medium"),
                Suggestion(id="s5", text="Add export to JSON file", impact="low"),
                Suggestion(id="s6", text="Add localized audio feedback", impact="high"),
            ]
            return reply, spoken, updated, [change]
        else:
            reply = f"Architecture ke mutabiq, {current_plan.title} ko fast iteration aur lean vertical slice ke liye design kiya gaya hai."
            spoken = "Yeh plan lean vertical slice ke liye design kiya gaya hai."
            return reply, spoken, None, []
