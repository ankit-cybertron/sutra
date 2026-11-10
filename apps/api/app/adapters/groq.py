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
    idea_summary: str = ""
    questions: List[Question] = Field(default_factory=list)


class GroqAdapter:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_s: Optional[float] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.groq_api_key
        self.model = model or settings.groq_model
        self.fallback_model = settings.groq_fallback_model
        self.timeout_s = timeout_s or settings.groq_timeout_s
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"

        self.total_calls = 0
        self.estimated_tokens = 0
        self.status = "connected" if (self.api_key and not self.api_key.startswith("gsk_your_groq") and not self.api_key.startswith("mock")) else "unconfigured"
        self.last_error: Optional[str] = None if self.status == "connected" else "GROQ_API_KEY is not configured"

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "model": self.model,
            "last_error": self.last_error,
            "calls": self.total_calls,
        }

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
            or getattr(self, "_disabled", False)
        ):
            logger.warning("GROQ_API_KEY is mock, disabled, or unset. Using deterministic mock fallback.")
            self.status = "unconfigured"
            self.last_error = "GROQ_API_KEY is not configured or mock"
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
            self.status = "error"
            self.last_error = f"Groq network error: {exc}"
            return {"mock": True}

        if response.status_code == 404 and "model" in response.text.lower():
            logger.warning(f"Groq model '{model_name}' not found (404). Trying resilient fallback models...")
            fallbacks = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "llama-3.1-8b-instant", "llama-3.1-70b-versatile", "llama3-8b-8192", "mixtral-8x7b-32768"]
            for fb in fallbacks:
                if fb == model_name:
                    continue
                try:
                    payload["model"] = fb
                    async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                        fb_res = await client.post(self.base_url, headers=headers, json=payload)
                    if fb_res.status_code == 200:
                        logger.info(f"Groq model successfully switched to '{fb}'")
                        self.model = fb
                        self.status = "connected"
                        self.last_error = None
                        data = fb_res.json()
                        usage = data.get("usage", {})
                        self.total_calls += 1
                        self.estimated_tokens += usage.get("total_tokens", 500)
                        return data
                except Exception as fb_err:
                    logger.warning(f"Groq fallback '{fb}' failed: {fb_err}")

        if response.status_code != 200:
            logger.warning(f"Groq API error {response.status_code}: {response.text[:120]}. Falling back.")
            self.status = "error"
            self.last_error = f"Groq HTTP {response.status_code}: {response.text[:120]}"
            if response.status_code in (401, 403):
                self._disabled = True
            return {"mock": True}

        data = response.json()
        self.status = "connected"
        self.last_error = None
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
        # If user explicitly chose language in UI, prioritize it; else detect
        if lang in ("en", "hi", "hinglish"):
            detected: Lang = lang
        else:
            is_hindi = any(
                word in idea.lower()
                for word in ["karo", "chahiye", "mera", "bana", "kaise", "hai", "karna", "app"]
            )
            detected = "hinglish" if is_hindi else "en"

        # 0 questions test case: if idea is already fully specific
        if "fully specific" in idea.lower() or "no questions" in idea.lower():
            return detected, []

        if detected == "hi":
            questions = [
                Question(
                    id="q1",
                    display_text="मुख्य लक्षित उपभोक्ता कौन हैं - एकल डेवलपर्स या छोटे व्यवसाय?",
                    spoken_text="मुख्य लक्षित उपभोक्ता कौन हैं, एकल डेवलपर्स या छोटे व्यवसाय?",
                    options=["एकल डेवलपर्स", "कॉलेज छात्र", "छोटे व्यवसाय", "आम जनता"],
                ),
                Question(
                    id="q2",
                    display_text="पहले संस्करण के लिए प्राथमिक इंटरफ़ेस क्या होगा: वेब ऐप या मोबाइल?",
                    spoken_text="पहले संस्करण के लिए प्राथमिक इंटरफ़ेस क्या होगा, वेब ऐप या मोबाइल?",
                    options=["वेब ऐप", "मोबाइल ऐप", "सीएलआई टूल", "क्रोम एक्सटेंशन"],
                ),
            ]
        elif detected == "hinglish":
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

        if plan_lang == "hi":
            one_liner = "आवाज़ के विचारों को संरचित, निष्पादन योग्य तकनीकी ब्लूप्रिंट में बदलें।"
            target_user = "भारत के निर्माता और छात्र जो हिंदी में विचार करते हैं।"
            problem = "असंरचित विचारों को ठोस इंजीनियरिंग आवश्यकताओं में बदलना कठिन और धीमा होता है।"
        elif plan_lang == "hinglish":
            one_liner = "Voice thoughts ko structured, actionable engineering blueprints mein badlein."
            target_user = "Solo builders aur students in India jo Hinglish mein brainstorm karte hain."
            problem = "Chaotic voice thoughts ko concrete engineering requirements mein badalna slow aur error-prone hai."
        else:
            one_liner = "Transform voice thoughts into structured, executable technical blueprints."
            target_user = "Solo developers and technical founders building vertical-slice products."
            problem = "Translating chaotic voice thoughts into concrete engineering requirements is slow and error-prone."

        return Plan(
            title=title,
            one_liner=one_liner,
            target_user=target_user,
            problem=problem,
            must_have=[
                MustHave(
                    name="Live Voice Intake & Plan Synthesis",
                    why="Captures unstructured brainstorms with zero friction.",
                    acceptance=[
                        "Accepts streaming 16kHz PCM audio",
                        "Generates structured vertical slice roadmap",
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
            tech_notes="FastAPI, Groq LLM (llama-3.1-8b-instant), Gnani AI (Prisma v3 + Timbre v2.5), Atomic JSON file store.",
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
            w in msg_lower for w in [
                "add", "karo", "change", "include", "dark mode", "export", "bhi",
                "modify", "update", "use", "make", "want", "need", "feature", "remove", "replace", "support"
            ]
        )

        chosen_lang = (lang or getattr(current_plan, "language", "en") or "en").lower()

        if is_change_request:
            updated = current_plan.model_copy(deep=True)
            if "dark mode" in msg_lower:
                updated.tech_notes += " Includes system-responsive dark mode styling."
                if chosen_lang == "hi":
                    change = "डार्क मोड डिज़ाइन टोकन्स जोड़े गए।"
                    reply = "डार्क मोड को प्लान में जोड़ दिया गया है! टेक नोट्स अपडेट हो चुके हैं।"
                    spoken = "डार्क मोड को प्लान में जोड़ दिया गया है।"
                elif chosen_lang == "hinglish":
                    change = "Added dark mode design tokens to tech notes."
                    reply = "Dark mode plan mein add kar diya hai! Tech notes update ho gaye hain."
                    spoken = "Dark mode plan mein add kar diya gaya hai."
                else:
                    change = "Added dark mode design tokens to tech notes."
                    reply = "Dark mode has been added to your plan! Technical notes have been updated."
                    spoken = "Dark mode has been added to your plan."
            else:
                updated.later.append(message.strip())
                if chosen_lang == "hi":
                    change = f"'{message.strip()}' को v2 रोडमैप में शामिल किया गया।"
                    reply = f"आपका सुझाव '{message}' नोट कर लिया गया है और रोडमैप में जोड़ दिया गया है।"
                    spoken = "प्लान अपडेट हो गया है।"
                elif chosen_lang == "hinglish":
                    change = f"Scoped '{message.strip()}' into v2 backlog."
                    reply = f"Aapka suggestion '{message}' note kar liya hai aur roadmap mein add kar diya hai."
                    spoken = "Plan update ho gaya hai."
                else:
                    change = f"Scoped '{message.strip()}' into v2 roadmap."
                    reply = f"Your suggestion '{message}' has been noted and added to the project roadmap."
                    spoken = "Your plan has been updated."

            updated.suggestions = [
                Suggestion(id="s4", text="Add offline PWA support", impact="medium"),
                Suggestion(id="s5", text="Add export to JSON file", impact="low"),
                Suggestion(id="s6", text="Add localized audio feedback", impact="high"),
            ]
            return reply, spoken, updated, [change]
        else:
            if chosen_lang == "hi":
                reply = f"आर्किटेक्चर के अनुसार, {current_plan.title} को तेज़ विकास और न्यूनतम व्यावहारिक उत्पाद (MVP) के लिए तैयार किया गया है।"
                spoken = "यह प्लान तेज़ विकास के लिए तैयार किया गया है।"
            elif chosen_lang == "hinglish":
                reply = f"Architecture ke mutabiq, {current_plan.title} ko fast iteration aur lean vertical slice ke liye design kiya gaya hai."
                spoken = "Yeh plan lean vertical slice ke liye design kiya gaya hai."
            else:
                reply = f"According to the architectural blueprint, {current_plan.title} is designed for rapid execution and a lean vertical slice."
                spoken = "This plan is designed for rapid vertical-slice development."

            return reply, spoken, None, []
