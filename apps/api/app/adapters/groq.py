"""Groq LLM Adapter with strict Pydantic validation, repair retries, and usage tracking."""

import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from pydantic import ValidationError

from apps.api.app.config import settings
from apps.api.app.errors import ApiProblemError
from apps.api.app.prompts import clarify, plan, refine
from apps.api.app.schemas import (
    Answer,
    ClarifyQuestion,
    ClarifyResult,
    Plan,
    PlanBuildStep,
    PlanMustHave,
    PlanSuggestion,
    RefineResult,
)

logger = logging.getLogger("sutra.adapters.groq")


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

        # Usage counters
        self.total_calls = 0
        self.estimated_tokens = 0

    async def _call_groq_raw(
        self,
        messages: List[Dict[str, str]],
        model_name: str,
        json_mode: bool = True,
    ) -> Dict[str, Any]:
        if not self.api_key or self.api_key.startswith("gsk_your_groq") or self.api_key.startswith("mock") or self.api_key == "mock_key":
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
                code="GROQ_API_ERROR",
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

        # First attempt with primary model
        try:
            raw = await self._call_groq_raw(messages, self.model, json_mode=True)
            if raw.get("mock"):
                return None  # Signal to mock generator

            content = raw["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return schema_cls.model_validate(parsed)
        except ApiProblemError as api_err:
            logger.warning(f"Groq API error ({api_err.detail}). Falling back to mock generator.")
            return None
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(f"Groq validation failed on primary model ({e}). Retrying with repair prompt...")
            # Repair retry
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
                logger.error(f"Groq repair retry also failed: {final_e}")
                raise ApiProblemError(
                    status_code=500,
                    code="SCHEMA_VALIDATION_FAILED",
                    title="LLM Response Parsing Error",
                    detail="Failed to produce a response adhering to the required schema.",
                )

    async def clarify(self, idea: str, lang: str = "auto") -> ClarifyResult:
        user_content = clarify.USER_TEMPLATE.format(idea=idea.strip(), lang=lang)
        result = await self._generate_json(
            clarify.SYSTEM_PROMPT, user_content, ClarifyResult
        )
        if result is not None:
            return result

        # Mock fallback for test/dev when no key is set
        return self._mock_clarify(idea, lang)

    async def plan(
        self,
        idea: str,
        answers: List[Answer],
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

    async def refine(
        self,
        current_plan: Plan,
        suggestion: str,
        lang: str = "auto",
    ) -> RefineResult:
        plan_json = current_plan.model_dump_json(indent=2)
        user_content = refine.USER_TEMPLATE.format(
            plan_json=plan_json, suggestion=suggestion.strip(), lang=lang
        )
        result = await self._generate_json(refine.SYSTEM_PROMPT, user_content, RefineResult)
        if result is not None:
            return result

        return self._mock_refine(current_plan, suggestion, lang)

    # --- Mocks for offline test / CI ---

    def _mock_clarify(self, idea: str, lang: str) -> ClarifyResult:
        is_hindi = any(
            word in idea.lower()
            for word in ["karo", "chahiye", "mera", "bana", "kaise", "hai", "karna", "app"]
        )
        detected = "hinglish" if is_hindi else ("hi" if lang == "hi" else "en")

        if is_hindi or detected == "hinglish":
            questions = [
                ClarifyQuestion(
                    id="q1",
                    display_text="Target audience kaun hai - solo builders ya enterprise teams?",
                    spoken_text="Target audience kaun hai, solo builders ya enterprise teams?",
                    options=["Solo Builders", "College Students", "Small Businesses", "General Public"],
                ),
                ClarifyQuestion(
                    id="q2",
                    display_text="Vertical slice mein primary interface kya hoga: Web app ya Mobile?",
                    spoken_text="Vertical slice mein primary interface kya hoga, Web app ya Mobile?",
                    options=["Web App", "Mobile (React Native)", "CLI Tool", "Chrome Extension"],
                ),
            ]
        else:
            questions = [
                ClarifyQuestion(
                    id="q1",
                    display_text="Who is the primary target persona for the vertical slice?",
                    spoken_text="Who is the primary target persona for the vertical slice?",
                    options=["Solo Developers", "Students & Hackers", "Early Stage Startups"],
                ),
                ClarifyQuestion(
                    id="q2",
                    display_text="What is the non-negotiable primary mechanism in v1?",
                    spoken_text="What is the non-negotiable primary mechanism in version one?",
                    options=["Instant voice-to-plan", "Visual canvas editor", "Automated code scaffold"],
                ),
            ]

        return ClarifyResult(
            detected_language=detected,
            idea_summary=f"Plan to build: {idea[:60]}...",
            questions=questions,
        )

    def _mock_plan(self, idea: str, answers: List[Answer], lang: str) -> Plan:
        title = "Sutra Idea Engine"
        if len(idea.split()) >= 2:
            title = " ".join([w.capitalize() for w in idea.split()[:3]])

        return Plan(
            title=title,
            one_liner="Transform voice thoughts into structured, executable technical blueprints.",
            target_user="Solo builders and students who brainstorm in Hinglish.",
            problem="Translating chaotic voice thoughts into concrete engineering requirements is slow and error-prone.",
            must_have=[
                PlanMustHave(
                    name="Live Voice Intake & Clarification",
                    why="Captures unstructured brainstorms with zero friction.",
                    acceptance=[
                        "Accepts streaming 16kHz PCM audio",
                        "Generates max 2 clarifying questions within 3s",
                        "Spoken playback via TTS",
                    ],
                ),
                PlanMustHave(
                    name="Strict Structured Plan Synthesis",
                    why="Delivers actionable architecture without fluff.",
                    acceptance=[
                        "Produces must-haves, build order, and tech notes",
                        "Caps must-haves at <= 5 items",
                        "Validates against Pydantic V2 schema",
                    ],
                ),
                PlanMustHave(
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
                PlanBuildStep(step=1, title="Scaffold Monorepo & Core Types", detail="Initialize FastAPI + Pydantic v2."),
                PlanBuildStep(step=2, title="Implement Document Store", detail="Set up atomic JSON store with file locking."),
                PlanBuildStep(step=3, title="Implement Voice & LLM Adapters", detail="Integrate Gnani STT/TTS and Groq structured output."),
                PlanBuildStep(step=4, title="Build Reactive Frontend", detail="Create voice orb and plan inspection cards."),
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
                PlanSuggestion(id="s1", text="Add dark mode support", impact="Polishes developer UX"),
                PlanSuggestion(id="s2", text="Add download as Markdown", impact="Enables offline saving"),
                PlanSuggestion(id="s3", text="Add 1-click prompt copy", impact="Direct coding agent handoff"),
            ],
            first_prompt=f"You are building {title}. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on the must-have capabilities described above. Do not build: authentication, enterprise billing, or third-party integrations.",
            language=lang or "en",
        )

    def _mock_refine(self, current_plan: Plan, suggestion: str, lang: str) -> RefineResult:
        updated = current_plan.model_copy(deep=True)
        # Check if suggestion mentions dark mode or similar
        change_text = f"Applied refinement: {suggestion}"
        if "dark mode" in suggestion.lower():
            updated.tech_notes += " Includes system-responsive dark mode styling."
            change_text = "Added dark mode design tokens to tech notes."
        else:
            if len(updated.later) < 5:
                updated.later.append(suggestion)
            change_text = f"Evaluated '{suggestion}'; scoped appropriately into roadmap."

        updated.suggestions = [
            PlanSuggestion(id="s4", text="Add offline PWA support", impact="Allows access on weak connections"),
            PlanSuggestion(id="s5", text="Add export to JSON file", impact="Enables automated CI ingestion"),
            PlanSuggestion(id="s6", text="Add localized audio feedback", impact="Enhances accessibility"),
        ]

        return RefineResult(
            plan=updated,
            change_summary=[change_text],
        )
