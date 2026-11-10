"""Groq LLM Adapter with strict Pydantic validation, repair retries, and usage tracking."""

import json
import logging
import re
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

STOP_WORDS = {
    "we", "are", "trying", "to", "make", "an", "app", "that", "like", "for", "a",
    "the", "in", "is", "of", "and", "with", "this", "want", "build", "create",
    "need", "system", "platform", "tool", "something", "helps", "users", "people",
    "mera", "bana", "karo", "hai", "kaise", "ek", "yeh", "apna", "karna", "chahte", "hain"
}


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
        ):
            logger.warning("GROQ_API_KEY is mock or unset. Using deterministic mock fallback.")
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
            fallbacks = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"]
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

    # --- Domain Profile & Dynamic Synthesis Fallback ---

    def _extract_domain_profile(self, idea: str, answers: List[AnswerInput], lang: str) -> Dict[str, Any]:
        combined = (idea + " " + " ".join([a.text for a in answers])).lower()
        plan_lang: Lang = "hi" if lang == "hi" else ("hinglish" if lang == "hinglish" else "en")

        # 1. Health / Clinic / Doctor / Patient
        if any(k in combined for k in ["clinic", "doctor", "patient", "appointment", "medical", "health", "hospital", "slot", "slots", "dawa", "ilaj"]):
            if plan_lang == "hi":
                return {
                    "title": "क्लिनिक स्लॉट और मरीज़ अपॉइंटमेंट मैनेजर",
                    "one_liner": "व्हाट्सएप स्वचालित पुष्टि और बिना प्रतीक्षा के क्लिनिक स्लॉट बुकिंग।",
                    "target_user": "स्थानीय डॉक्टर, क्लिनिक रिसेप्शनिस्ट और परामर्श के लिए आने वाले मरीज़।",
                    "problem": "क्लिनिक में अनियंत्रित भीड़, मैन्युअल रजिस्टर प्रविष्टियाँ और अपॉइंटमेंट में अनुपस्थिति।",
                    "core_loop": [
                        "मरीज़ क्लिनिक वेब लिंक पर समय स्लॉट चुनता है",
                        "डॉक्टर या रिसेप्शनिस्ट टोकन की पुष्टि करता है",
                        "विज़िट से 2 घंटे पहले व्हाट्सएप पर स्वचालित रिमाइंडर भेजा जाता है"
                    ],
                    "readiness_score": 93,
                    "must_have": [
                        MustHave(name="रीयल-टाइम स्लॉट बुकिंग और टोकन जनरेशन", why="डबल बुकिंग रोकता है और पारदर्शी कतार बनाता है।", acceptance=["उपलब्ध स्लॉट्स का रीयल-टाइम कैलेंडर", "त्वरित डिजिटल टोकन जारी करना", "मोबाइल-फ्रेंडली 1-टैप फॉर्म"]),
                        MustHave(name="व्हाट्सएप स्वचालित पुष्टि व रिमाइंडर", why="मरीज़ों की अनुपस्थिति दर को 70% तक कम करता है।", acceptance=["बुकिंग के तुरंत बाद संदेश प्रेषण", "विज़िट से 2 घंटे पहले अलर्ट", "रद्दीकरण की सीधी लिंक"]),
                        MustHave(name="दैनिक क्लिनिक कतार डैशबोर्ड", why="डॉक्टर को वर्तमान मरीज़ प्रवाह की स्पष्ट जानकारी देता है।", acceptance=["लाइव टोकन स्थिति बोर्ड", "कंसल्टेशन पूर्ण/प्रगति में टॉगल", "दैनिक कुल मरीज़ रिपोर्ट"]),
                    ],
                    "later": ["डिजिटल प्रिस्क्रिप्शन और पीडीएफ निर्यात", "टेलीकंसल्टेशन वीडियो कॉलिंग", "मल्टी-ब्रांच क्लिनिक सपोर्ट"],
                    "out_of_scope": ["पूर्ण अस्पताल ईआरपी व बिलिंग", "बीमा दावा क्लीयरिंगहाउस"],
                    "build_order": [
                        BuildStep(step=1, title="क्लिनिक और अपॉइंटमेंट स्कीमा", detail="डॉक्टर, स्लॉट, अपॉइंटमेंट और टोकन मॉडल्स बनाएं।"),
                        BuildStep(step=2, title="स्लॉट लॉकिंग और बुकिंग इंजन", detail="रेस कंडीशन रोकने के लिए रेडिस लॉकिंग लागू करें।"),
                        BuildStep(step=3, title="व्हाट्सएप वेबहुक एकीकरण", detail="बुकिंग इवेंट्स पर स्वचालित व्हाट्सएप संदेश भेजें।"),
                        BuildStep(step=4, title="रिसेप्शनिस्ट कतार यूआई", detail="मरीज़ बुकिंग इंटरफ़ेस और डॉक्टर टोकन बोर्ड बनाएं।"),
                    ],
                    "tech_notes": "FastAPI, PostgreSQL, Redis, Twilio/WhatsApp Cloud API, React + Tailwind.",
                    "risks": ["इंटरनेट धीमा होने पर क्लिनिक में टोकन सिंक में देरी", "बिना बुकिंग वाले इमरजेंसी मरीज़"],
                    "assumptions": ["क्लिनिक स्टाफ के पास स्मार्टफोन या टैबलेट है", "मरीज़ों के पास व्हाट्सएप सक्रिय है"],
                    "open_questions": ["क्या परामर्श शुल्क का भुगतान ऑनलाइन लेना है या क्लिनिक काउंटर पर?"],
                    "first_prompt": "You are building Clinic Slot & Patient Appointment Manager. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on: 1) Real-time slot booking with token generation, 2) Receptionist daily queue board, and 3) WhatsApp booking webhook notifications. Do not build: hospital inventory, complex insurance billing, or multi-clinic hierarchies.",
                }
            elif plan_lang == "hinglish":
                return {
                    "title": "Clinic Slot & Patient Appointment Manager",
                    "one_liner": "WhatsApp automated reminders ke saath zero-wait clinic slot booking engine.",
                    "target_user": "Local doctors, clinic receptionists aur walk-in patients.",
                    "problem": "Clinic mein lambi bheed, manual register entries aur patient no-shows.",
                    "core_loop": [
                        "Patient clinic web link par available slot book karta hai",
                        "Doctor ya receptionist token confirm karta hai",
                        "WhatsApp par instant confirmation aur reminder deliver hota hai"
                    ],
                    "readiness_score": 93,
                    "must_have": [
                        MustHave(name="Real-time Slot Booking & Token Engine", why="Double-booking eliminate karta hai aur queue transparent banata hai.", acceptance=["Real-time calendar slot locking", "Instant digital token generation", "Mobile-optimized booking intake"]),
                        MustHave(name="WhatsApp Automated Confirmations & Alerts", why="Patient no-show rate ko drastically drop karta hai.", acceptance=["Instant booking confirmation template", "2-hour pre-visit alert dispatch", "1-tap cancellation link"]),
                        MustHave(name="Receptionist Live Queue Dashboard", why="Clinic staff ko patient status ka real-time control deta hai.", acceptance=["Live token status board", "Toggle: Waiting / With Doctor / Done", "Daily patient count overview"]),
                    ],
                    "later": ["Digital prescription PDF export", "Telehealth video consultation link", "Multi-branch clinic network"],
                    "out_of_scope": ["Full hospital ERP & pharmacy inventory", "Health insurance claim processing"],
                    "build_order": [
                        BuildStep(step=1, title="Scaffold Clinic & Slot Models", detail="Define Doctors, Slots, Appointments and Token entities in SQLAlchemy."),
                        BuildStep(step=2, title="Implement Atomic Booking Engine", detail="Add Redis slot locking to prevent concurrent double bookings."),
                        BuildStep(step=3, title="Integrate WhatsApp Webhooks", detail="Trigger automated confirmation and reminder notifications."),
                        BuildStep(step=4, title="Build Responsive Queue Board", detail="Create mobile booking view and receptionist queue board in React."),
                    ],
                    "tech_notes": "FastAPI, PostgreSQL, Redis for slot locking, WhatsApp Business API, React + Vite.",
                    "risks": ["WhatsApp template delivery delays on low connectivity", "Emergency walk-ins bypassing the queue"],
                    "assumptions": ["Clinic has a basic smartphone or tablet", "Patients have active WhatsApp accounts"],
                    "open_questions": ["Should patients pay consultation fee upfront or at clinic counter?"],
                    "first_prompt": "You are building Clinic Slot & Patient Appointment Manager. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on: 1) Real-time slot booking with token generation, 2) Receptionist daily queue board, and 3) WhatsApp booking webhook notifications. Do not build: hospital inventory, complex insurance billing, or multi-clinic hierarchies.",
                }
            else:
                return {
                    "title": "Clinic Slot & Patient Appointment Manager",
                    "one_liner": "Zero-wait clinic scheduling and automated patient reminders over WhatsApp.",
                    "target_user": "Independent doctors, clinic receptionists, and outpatient visitors.",
                    "problem": "Chaotic waiting rooms, double bookings from manual registers, and high patient no-shows.",
                    "core_loop": [
                        "Patient selects appointment slot on mobile web booking link",
                        "Doctor or receptionist confirms booking and generates queue token",
                        "Automated WhatsApp notification and 2-hour reminder sent to patient"
                    ],
                    "readiness_score": 93,
                    "must_have": [
                        MustHave(name="Live Slot Availability & Token Intake", why="Eliminates double bookings and provides queue transparency.", acceptance=["Real-time calendar slot locking", "Instant digital token generation", "Mobile-friendly 1-tap booking form"]),
                        MustHave(name="WhatsApp Automated Confirmation & Dunning", why="Reduces missed appointments by over 70%.", acceptance=["Instant WhatsApp template dispatch", "2-hour pre-visit automated alert", "One-tap cancellation link"]),
                        MustHave(name="Doctor & Receptionist Daily Queue Board", why="Provides clinic staff immediate visibility into patient progress.", acceptance=["Live token status board", "Single-click status progression (Waiting, In Consultation, Done)", "Daily patient volume summary"]),
                    ],
                    "later": ["Digital prescription upload & PDF generator", "Telehealth video consultation link", "Multi-branch clinic management"],
                    "out_of_scope": ["Full hospital inpatient ERP", "Health insurance claims clearinghouse"],
                    "build_order": [
                        BuildStep(step=1, title="Scaffold Clinic & Appointment Schema", detail="Model Doctors, TimeSlots, Appointments, and QueueTokens."),
                        BuildStep(step=2, title="Implement Atomic Slot Locking", detail="Redis-based concurrency guard to prevent race condition bookings."),
                        BuildStep(step=3, title="Integrate WhatsApp Webhooks", detail="Event dispatchers for booking confirmation and reminder triggers."),
                        BuildStep(step=4, title="Build Responsive Receptionist UI", detail="Patient booking interface and real-time clinic queue board."),
                    ],
                    "tech_notes": "FastAPI, PostgreSQL, Redis for slot locking, Twilio / WhatsApp Cloud API, React + Vite.",
                    "risks": ["WhatsApp template delivery delays", "Emergency walk-in patients bypassing slot limits"],
                    "assumptions": ["Clinic staff has internet-connected mobile or tablet", "Patients have WhatsApp installed"],
                    "open_questions": ["Should patients pay consultation fees upfront or at clinic counter?"],
                    "first_prompt": "You are building Clinic Slot & Patient Appointment Manager. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on: 1) Real-time slot booking with token generation, 2) Receptionist daily queue board, and 3) WhatsApp booking webhook notifications. Do not build: hospital inventory, complex insurance billing, or multi-clinic hierarchies.",
                }

        # 2. CI/CD / Testing / Flaky Tests / DevOps
        if any(k in combined for k in ["test", "tests", "failure", "flaky", "triage", "ci", "cd", "github", "pipeline", "runner", "crash", "bug"]):
            return {
                "title": "Automated CI Test Failure Triage Engine",
                "one_liner": "Isolate flaky tests, parse build logs, and suggest instant root causes directly in PRs.",
                "target_user": "Software engineering teams running high-frequency CI/CD pipelines on GitHub Actions.",
                "problem": "Engineers waste hours rerunning entire suites due to non-deterministic flaky failures and opaque logs.",
                "core_loop": [
                    "CI webhook pushes failed build logs to triage service",
                    "Triage engine clusters error stack traces and calculates flake score",
                    "Service posts actionable root-cause comment directly on GitHub PR"
                ],
                "readiness_score": 94,
                "must_have": [
                    MustHave(name="Webhook Intake & Log Ingestion", why="Captures CI run artifacts automatically.", acceptance=["Accepts GitHub Actions webhook payloads", "Streams raw stdout/stderr logs", "Sanitizes secrets and tokens"]),
                    MustHave(name="Flaky Test Detection & Clustering", why="Distinguishes true regressions from infrastructure noise.", acceptance=["Tracks failure frequency across last 50 runs", "Flags historical non-determinism", "Groups identical stack traces"]),
                    MustHave(name="Actionable PR Diagnostic Commenter", why="Saves developer time without leaving GitHub.", acceptance=["Formats isolated failure summary in markdown", "Shows snippet of failing line and assertion", "Posts or updates PR review comment"]),
                ],
                "later": ["Automated PR rerun for isolated flaky tests", "Integration with Slack build channels", "Historical failure trend analytics dashboard"],
                "out_of_scope": ["Hosting custom CI runners", "Automated code rewriting without review"],
                "build_order": [
                    BuildStep(step=1, title="Scaffold Webhook & Build Run Schema", detail="Log schema, TestRun entities, GitHub webhook verification."),
                    BuildStep(step=2, title="Implement Log Parser & Trace Matcher", detail="Regex and AST parser for Python, JS, and Go test failures."),
                    BuildStep(step=3, title="Build Flake Score Engine", detail="Rolling window database query to score test stability."),
                    BuildStep(step=4, title="Implement GitHub PR Comment Bot", detail="GitHub API integration for sticky PR commentary."),
                ],
                "tech_notes": "FastAPI, ClickHouse / PostgreSQL, GitHub Apps API, Celery / Redis background worker, React dashboard.",
                "risks": ["Exceeding GitHub API rate limits on busy monorepos", "Extremely large build log files causing memory spikes"],
                "assumptions": ["Repository uses standard JUnit XML or console test outputs", "Teams have admin access to install GitHub App"],
                "open_questions": ["Should the bot automatically quarantine known flaky tests in CI config?"],
                "first_prompt": "You are building Automated CI Test Failure Triage Engine. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on: 1) GitHub Actions webhook listener for failed workflow runs, 2) Log parser identifying failed assertions, and 3) GitHub PR bot posting root-cause summaries. Do not build: custom runner runners, multi-tenant billing, or automated code modifications.",
            }

        # 3. Kirana / Hyperlocal Delivery
        if any(k in combined for k in ["kirana", "grocery", "delivery", "food", "restaurant", "order", "hyperlocal", "ration", "dukan"]):
            return {
                "title": "Hyperlocal Kirana Delivery & Inventory Engine",
                "one_liner": "Real-time neighborhood store catalog, instant order dispatch, and live stock tracking.",
                "target_user": "Local neighborhood store owners and nearby resident households.",
                "problem": "Small neighborhood shops lose customers to quick-commerce apps due to lack of digital ordering and live inventory.",
                "core_loop": [
                    "Customer selects daily essentials from neighborhood store catalog",
                    "Store merchant receives audio order ping and packs items",
                    "Assigned neighborhood runner delivers order and collects UPI payment"
                ],
                "readiness_score": 91,
                "must_have": [
                    MustHave(name="Lightweight Mobile Store Catalog", why="Enables fast browsing on slow mobile connections.", acceptance=["Loads catalog in under 1 second", "Supports regional item search in Hindi & English", "Instant cart additions"]),
                    MustHave(name="Merchant Audio Order Receiver", why="Ensures store owners never miss an incoming order.", acceptance=["Loud audible chime on incoming orders", "1-tap accept or mark out-of-stock", "Item checklist for quick packing"]),
                    MustHave(name="Order Status & Delivery Dispatch", why="Keeps customers informed in real-time.", acceptance=["Order lifecycle states: Received, Packed, Out for Delivery, Delivered", "Live runner contact link", "Dynamic UPI QR code"]),
                ],
                "later": ["Automated supplier restocking orders", "Customer loyalty ledger (Khata book integration)", "Barcode scanner for store shelf updates"],
                "out_of_scope": ["Warehouse dark-store logistics networks", "Cold-chain fleet tracking"],
                "build_order": [
                    BuildStep(step=1, title="Model Store, Product Catalog, & Orders", detail="High-concurrency schema with category tags."),
                    BuildStep(step=2, title="Build Customer Ordering PWA", detail="Ultra-fast mobile web client with offline caching."),
                    BuildStep(step=3, title="Build Merchant Audio Dashboard", detail="WebAudio order alerts and order management."),
                    BuildStep(step=4, title="Implement UPI Payment Flow & Status Tracking", detail="Dynamic QR generation and status polling."),
                ],
                "tech_notes": "FastAPI, PostgreSQL, Redis Pub/Sub for live order alerts, React PWA with ServiceWorker, UPI QR generator.",
                "risks": ["Inaccurate shelf stock during rush hours", "Spotty cellular data for delivery runners"],
                "assumptions": ["Stores operate within a 2-3 km delivery radius", "Customers prefer paying via UPI upon delivery"],
                "open_questions": ["Should delivery fees be flat or calculated by distance?"],
                "first_prompt": "You are building Hyperlocal Kirana Delivery & Inventory Engine. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on: 1) Fast customer catalog and cart, 2) Merchant audio order alert and acceptance screen, and 3) Order status lifecycle with dynamic UPI QR code. Do not build: central dark-store logistics, multi-city franchising, or supplier ERP.",
            }

        # 4. Freelance Invoices & Payments
        if any(k in combined for k in ["invoice", "invoices", "billing", "freelance", "payment", "client", "receipt", "khata", "gst", "tax"]):
            return {
                "title": "Freelancer Smart Invoicing & Payment Tracker",
                "one_liner": "Generate professional client invoices in seconds and automate gentle payment reminders.",
                "target_user": "Independent contractors, freelance creators, and boutique design/dev studios.",
                "problem": "Freelancers waste unbillable hours formatting invoices and dread awkward follow-ups for late payments.",
                "core_loop": [
                    "Freelancer inputs billable hours and milestones into simple form",
                    "System generates branded PDF invoice with embedded payment link",
                    "Automated polite reminders notify client before and on due date"
                ],
                "readiness_score": 92,
                "must_have": [
                    MustHave(name="60-Second Branded Invoice Generator", why="Cuts billing admin time to zero.", acceptance=["Calculates itemized subtotal, taxes, and discounts", "Generates downloadable crisp PDF", "Embeds direct payment link / UPI QR"]),
                    MustHave(name="Automated Dunning & Polite Reminders", why="Accelerates accounts receivable without awkward conversations.", acceptance=["Triggers reminder 3 days before due date", "Sends polite ping on due date", "Escalates overdue notice on day 7"]),
                    MustHave(name="Real-Time Cash Flow & Status Dashboard", why="Provides immediate visibility into unpaid receivables.", acceptance=["Highlights Overdue, Pending, and Paid totals", "1-tap manual reminder trigger", "Instant mark-as-paid toggle"]),
                ],
                "later": ["Multi-currency Stripe and PayPal webhook sync", "Time-tracking browser extension integration", "Quarterly tax and GST summary export"],
                "out_of_scope": ["Complex double-entry enterprise accounting", "Payroll management for salaried employees"],
                "build_order": [
                    BuildStep(step=1, title="Scaffold Invoice, Client & Line Item Entities", detail="Core accounting data structures."),
                    BuildStep(step=2, title="Implement PDF Rendering & Payment Link Engine", detail="Serverless PDF generator and payment link builder."),
                    BuildStep(step=3, title="Build Background Reminder Scheduler", detail="Cron job running daily dunning workflows."),
                    BuildStep(step=4, title="Build Clean Freelancer Cashflow Dashboard", detail="Modern dashboard with invoice status cards."),
                ],
                "tech_notes": "FastAPI, PostgreSQL, ReportLab / Playwright PDF renderer, Redis for scheduled reminder queues, React + Tailwind.",
                "risks": ["Client spam filters blocking reminder emails", "International currency exchange rate fluctuations"],
                "assumptions": ["Clients receive invoices via email or WhatsApp", "Freelancers bill on milestone or hourly basis"],
                "open_questions": ["Should late fees automatically accrue after 14 days overdue?"],
                "first_prompt": "You are building Freelancer Smart Invoicing & Payment Tracker. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on: 1) Instant branded invoice creation with PDF generation, 2) Client payment status dashboard (Pending, Overdue, Paid), and 3) Automated email/webhook reminder pipeline. Do not build: payroll systems, multi-currency ledger engines, or deep corporate tax accounting.",
            }

        # 5. Dynamic Custom Domain Synthesis
        words = [w for w in re.findall(r"[a-zA-Z0-9\u0900-\u097F]+", idea) if w.lower() not in STOP_WORDS and len(w) > 2]
        title_core = " ".join([w.capitalize() for w in words[:3]]) if words else "Custom App"
        title = f"{title_core} Engine"

        if plan_lang == "hi":
            return {
                "title": f"{title_core} प्लेटफ़ॉर्म",
                "one_liner": f"{title_core} के लिए एक तेज़, न्यूनतम और उपयोग में आसान डिजिटल समाधान।",
                "target_user": f"वे उपयोगकर्ता और डेवलपर्स जो {title_core} प्रक्रिया को सरल बनाना चाहते हैं।",
                "problem": f"{title_core} के क्षेत्र में मैन्युअल काम, देरी और स्पष्टता की कमी।",
                "core_loop": [
                    f"उपयोगकर्ता {title_core} में अपनी प्राथमिक आवश्यकता दर्ज करता है",
                    "सिस्टम नियमों के अनुसार डेटा को संसाधित और सत्यापित करता है",
                    "उपयोगकर्ता को तुरंत परिणाम और सूचना प्राप्त होती है"
                ],
                "readiness_score": 90,
                "must_have": [
                    MustHave(name=f"{title_core} प्राथमिक इनटेक इंजन", why=f"{title_core} के लिए त्वरित इनपुट संग्रह।", acceptance=["सत्यापित इनपुट प्रविष्टि", "डेटा अखंडता जांच", "त्वरित स्थिति प्रतिक्रिया"]),
                    MustHave(name=f"{title_core} प्रोसेसिंग व वर्कफ़्लो इंजन", why="मुख्य व्यावसायिक तर्क को कुशलता से निष्पादित करना।", acceptance=["स्वचालित नियम सत्यापन", "रीयल-टाइम स्टेट प्रबंधन", "त्रुटि प्रबंधन"]),
                    MustHave(name=f"{title_core} परिणाम व सारांश डैशबोर्ड", why="उपयोगकर्ता को स्पष्ट डेटा दृश्यता प्रदान करना।", acceptance=["विस्तृत स्थिति बोर्ड", "1-टैप एक्शन बटन", "एक्सपोर्ट क्षमता"]),
                ],
                "later": ["उन्नत एनालिटिक्स डैशबोर्ड", "तृतीय-पक्ष वेबहुक एकीकरण", "मल्टी-यूज़र टीम सहयोग"],
                "out_of_scope": ["भारी एंटरप्राइज अनुमति प्रबंधन", "मैन्युअल जटिल डेटाबेस प्रशासन"],
                "build_order": [
                    BuildStep(step=1, title="कोर डेटा मॉडल और स्कीमा", detail=f"{title_core} के लिए आवश्यक डेटाबेस इकाइयां बनाएं।"),
                    BuildStep(step=2, title="वर्कफ़्लो और बिज़नेस लॉजिक", detail="कोर प्रोसेसिंग और वैलिडेशन सेवाएं लागू करें।"),
                    BuildStep(step=3, title="एपीआई और नोटिफिकेशन एंडपॉइंट्स", detail="फास्टएपीआई रूटर्स और इवेंट ट्रिगर बनाएं।"),
                    BuildStep(step=4, title="रिस्पॉन्सिव रिएक्ट यूआई", detail="क्लाइंट डैशबोर्ड और इंटरेक्टिव कंपोनेंट्स जोड़ें।"),
                ],
                "tech_notes": "FastAPI, PostgreSQL, Redis, React + Vite, Tailwind CSS.",
                "risks": ["बढ़ते उपयोगकर्ताओं के साथ डेटाबेस स्केलेबिलिटी", "धीमे नेटवर्क पर विलंबता"],
                "assumptions": ["उपयोगकर्ता आधुनिक वेब ब्राउज़र का उपयोग कर रहे हैं", "कोर वर्कफ़्लो एकल-उपयोगकर्ता उपयोग के लिए है"],
                "open_questions": [f"क्या {title_core} में ऑफ़लाइन डेटा कैशिंग की आवश्यकता है?"],
                "first_prompt": f"You are building {title_core} Engine. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on the must-have capabilities described above. Do not build: authentication, enterprise billing, or third-party integrations.",
            }
        elif plan_lang == "hinglish":
            return {
                "title": f"{title_core} Platform",
                "one_liner": f"{title_core} ke liye fast, lean aur focused vertical-slice architecture.",
                "target_user": f"Builders aur end-users jo {title_core} workflow ko automate karna chahte hain.",
                "problem": f"{title_core} process mein manual effort, high friction aur lack of clarity.",
                "core_loop": [
                    f"User {title_core} mein core input submit karta hai",
                    f"System business rules ke mutabiq request validate aur process karta hai",
                    "Immediate structured output aur notification deliver hota hai"
                ],
                "readiness_score": 90,
                "must_have": [
                    MustHave(name=f"{title_core} Core Intake Engine", why=f"{title_core} ka data zero friction se capture karta hai.", acceptance=["Validated input fields", "Instant state reflection", "Schema validation"]),
                    MustHave(name=f"{title_core} Business Processing Engine", why="Core application logic ko reliably execute karta hai.", acceptance=["Automated rule engine", "Error handling pipeline", "State transitions"]),
                    MustHave(name=f"{title_core} Real-Time Status Board", why="End user ko continuous progress overview deta hai.", acceptance=["Live status indicators", "1-tap actions", "JSON/Markdown export"]),
                ],
                "later": ["Advanced metrics and historical logs", "Third-party webhook triggers", "Multi-user role access"],
                "out_of_scope": ["Complex enterprise auth matrix", "Heavy background data migrations"],
                "build_order": [
                    BuildStep(step=1, title="Scaffold Domain Schema", detail=f"Define core entities for {title_core}."),
                    BuildStep(step=2, title="Implement Business Logic", detail="Build validation and core processing pipelines."),
                    BuildStep(step=3, title="Create REST & WebSocket Endpoints", detail="FastAPI handlers with camelCase schemas."),
                    BuildStep(step=4, title="Build Reactive React Client", detail="Responsive web UI with live state updates."),
                ],
                "tech_notes": "FastAPI, PostgreSQL, Redis, React + Vite, Tailwind CSS.",
                "risks": ["Edge cases in unstructured user inputs", "API throughput limits under concurrent load"],
                "assumptions": ["Users prefer simple, fast workflows over bloated configuration", "Standard modern browser access"],
                "open_questions": [f"Should {title_core} support webhooks for downstream integrations in v1?"],
                "first_prompt": f"You are building {title_core} Platform. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on the must-have capabilities described above. Do not build: authentication, enterprise billing, or third-party integrations.",
            }
        else:
            return {
                "title": f"{title_core} Platform",
                "one_liner": f"A high-velocity, focused vertical-slice engine for {title_core.lower()} workflows.",
                "target_user": f"Founders, engineers, and operators streamlining {title_core.lower()} operations.",
                "problem": f"Fragmented manual steps, high friction, and lack of real-time visibility in {title_core.lower()}.",
                "core_loop": [
                    f"User submits primary {title_core.lower()} request via web or voice intake",
                    "System validates inputs and executes core domain rules",
                    "Actionable output, persistent record, and instant confirmation delivered"
                ],
                "readiness_score": 90,
                "must_have": [
                    MustHave(name=f"{title_core} Intake & Ingestion Engine", why=f"Captures {title_core.lower()} inputs with zero friction.", acceptance=["Strict schema validation", "Instant optimistic UI updates", "Mobile-friendly submission"]),
                    MustHave(name=f"{title_core} Core Processing Engine", why="Executes deterministic domain rules without external latency.", acceptance=["State machine transitions", "Atomic transaction safeguards", "Structured error reporting"]),
                    MustHave(name=f"{title_core} Operational Dashboard", why="Gives operators immediate visibility into ongoing workflows.", acceptance=["Live status tracking", "Actionable detail drill-down", "One-click export"]),
                ],
                "later": ["Advanced historical analytics", "Webhook dispatch to external tools", "Multi-tenant role-based permissions"],
                "out_of_scope": ["Heavy enterprise compliance suites", "Legacy system bidirectional sync"],
                "build_order": [
                    BuildStep(step=1, title="Scaffold Domain Schema & Entities", detail=f"Define SQLAlchemy models and Pydantic schemas for {title_core}."),
                    BuildStep(step=2, title="Implement Core Processing Service", detail="Write atomic domain service with unit test coverage."),
                    BuildStep(step=3, title="Expose REST API Endpoints", detail="FastAPI routers with RFC 7807 error handling."),
                    BuildStep(step=4, title="Build Reactive Frontend Client", detail="Modern React UI with live state reflection."),
                ],
                "tech_notes": "FastAPI, PostgreSQL, Redis, React + Vite, Tailwind CSS.",
                "risks": ["Unexpected user input edge cases", "Database contention under sudden traffic spikes"],
                "assumptions": ["Users prioritize execution speed over extensive manual configuration", "Client runs in modern evergreen browsers"],
                "open_questions": [f"Should {title_core} provide a CLI or direct webhook trigger in v1?"],
                "first_prompt": f"You are building {title_core} Platform. Scaffold the repository with FastAPI and React. Implement the vertical slice focusing strictly on the must-have capabilities described above. Do not build: authentication, enterprise billing, or third-party integrations.",
            }

    def _mock_clarify(self, idea: str, lang: str) -> Tuple[Lang, List[Question]]:
        if lang in ("en", "hi", "hinglish"):
            detected: Lang = lang
        else:
            is_hindi = any(
                word in idea.lower()
                for word in ["karo", "chahiye", "mera", "bana", "kaise", "hai", "karna", "app", "dawa", "dukan", "paisa"]
            )
            detected = "hinglish" if is_hindi else "en"

        if "fully specific" in idea.lower() or "no questions" in idea.lower():
            return detected, []

        idea_lower = idea.lower()

        # Domain-tailored questions
        if any(k in idea_lower for k in ["clinic", "doctor", "patient", "appointment", "health", "slot"]):
            if detected == "hi":
                questions = [
                    Question(id="q1", display_text="अपॉइंटमेंट बुकिंग का प्राथमिक तरीका क्या होगा?", spoken_text="अपॉइंटमेंट बुकिंग का प्राथमिक तरीका क्या होगा?", options=["मरीज़ मोबाइल वेब लिंक", "व्हाट्सएप चैटबॉट", "क्लिनिक काउंटर"]),
                    Question(id="q2", display_text="रिमाइंडर सूचनाएं किस माध्यम से भेजी जाएं?", spoken_text="रिमाइंडर सूचनाएं किस माध्यम से भेजी जाएं?", options=["व्हाट्सएप अलर्ट", "एसएमएस संदेश", "फोन कॉल"]),
                ]
            elif detected == "hinglish":
                questions = [
                    Question(id="q1", display_text="Patient booking ka primary channel kya hoga?", spoken_text="Patient booking ka primary channel kya hoga?", options=["Mobile Web Link", "WhatsApp Bot", "Walk-in Counter"]),
                    Question(id="q2", display_text="Confirmation aur reminders kaise dispatch hone chahiye?", spoken_text="Confirmation aur reminders kaise dispatch hone chahiye?", options=["WhatsApp Alerts", "SMS Text", "Email"]),
                ]
            else:
                questions = [
                    Question(id="q1", display_text="What is the primary patient booking intake channel?", spoken_text="What is the primary patient booking intake channel?", options=["Mobile Web Link", "WhatsApp Bot", "Reception Desk"]),
                    Question(id="q2", display_text="How should automated pre-visit reminders be dispatched?", spoken_text="How should automated pre-visit reminders be dispatched?", options=["WhatsApp Template", "SMS Alert", "Email"]),
                ]
        elif any(k in idea_lower for k in ["test", "tests", "failure", "flaky", "triage", "ci", "cd", "github"]):
            questions = [
                Question(id="q1", display_text="Which CI platform should the triage engine integrate with first?", spoken_text="Which CI platform should the triage engine integrate with first?", options=["GitHub Actions", "GitLab CI", "CircleCI"]),
                Question(id="q2", display_text="Where should diagnostic reports be posted?", spoken_text="Where should diagnostic reports be posted?", options=["Sticky PR Comments", "Slack Alert", "Standalone Dashboard"]),
            ]
        elif any(k in idea_lower for k in ["kirana", "grocery", "delivery", "food", "order"]):
            questions = [
                Question(id="q1", display_text="Who manages catalog prices and stock updates in v1?", spoken_text="Who manages catalog prices and stock updates in version one?", options=["Store Owner via Mobile", "CSV Bulk Upload", "Pre-set Standard Catalog"]),
                Question(id="q2", display_text="What is the primary payment collection method?", spoken_text="What is the primary payment collection method?", options=["UPI on Delivery", "Online Prepayment", "Store Cash / Khata"]),
            ]
        elif any(k in idea_lower for k in ["invoice", "invoices", "billing", "freelance", "payment"]):
            questions = [
                Question(id="q1", display_text="Which payment integration is required on invoice PDFs?", spoken_text="Which payment integration is required on invoice PDFs?", options=["Dynamic UPI QR", "Stripe Payment Link", "Direct Bank Account Details"]),
                Question(id="q2", display_text="How should overdue payment reminders be scheduled?", spoken_text="How should overdue payment reminders be scheduled?", options=["Automated 3-Day Dunning", "Manual 1-Tap Trigger", "Weekly Summary"]),
            ]
        else:
            words = [w for w in re.findall(r"[a-zA-Z0-9\u0900-\u097F]+", idea) if w.lower() not in STOP_WORDS and len(w) > 2]
            subject = words[0].capitalize() if words else "System"
            if detected == "hi":
                questions = [
                    Question(id="q1", display_text=f"{subject} के लिए प्राथमिक लक्षित उपभोक्ता कौन हैं?", spoken_text=f"{subject} के लिए प्राथमिक लक्षित उपभोक्ता कौन हैं?", options=["एकल डेवलपर्स", "छोटे व्यवसाय", "छात्र व शिक्षक"]),
                    Question(id="q2", display_text="पहले संस्करण के लिए प्राथमिक इंटरफ़ेस क्या होगा?", spoken_text="पहले संस्करण के लिए प्राथमिक इंटरफ़ेस क्या होगा?", options=["वेब ऐप (रिएक्ट)", "मोबाइल ऐप", "सीएलआई टूल"]),
                ]
            elif detected == "hinglish":
                questions = [
                    Question(id="q1", display_text=f"{subject} ke liye primary target persona kaun hai?", spoken_text=f"{subject} ke liye primary target persona kaun hai?", options=["Solo Builders", "Small Businesses", "Students"]),
                    Question(id="q2", display_text="Vertical slice mein core interface kya hona chahiye?", spoken_text="Vertical slice mein core interface kya hona chahiye?", options=["Web App (React)", "Mobile App", "CLI Tool"]),
                ]
            else:
                questions = [
                    Question(id="q1", display_text=f"Who is the primary target persona for {subject}?", spoken_text=f"Who is the primary target persona for {subject}?", options=["Solo Developers", "Small Businesses", "End Consumers"]),
                    Question(id="q2", display_text=f"What is the non-negotiable primary mechanism for {subject} in v1?", spoken_text=f"What is the non-negotiable primary mechanism in version one?", options=["Automated Core Engine", "Visual Interactive UI", "API & Webhook Service"]),
                ]

        return detected, questions

    def _mock_plan(self, idea: str, answers: List[AnswerInput], lang: str) -> Plan:
        plan_lang: Lang = "hi" if lang == "hi" else ("hinglish" if lang == "hinglish" else "en")
        profile = self._extract_domain_profile(idea, answers, lang)

        return Plan(
            title=profile["title"],
            one_liner=profile["one_liner"],
            target_user=profile["target_user"],
            problem=profile["problem"],
            core_loop=profile["core_loop"],
            readiness_score=profile["readiness_score"],
            must_have=profile["must_have"],
            later=profile["later"],
            out_of_scope=profile["out_of_scope"],
            build_order=profile["build_order"],
            tech_notes=profile["tech_notes"],
            risks=profile["risks"],
            assumptions=profile["assumptions"],
            open_questions=profile["open_questions"],
            suggestions=[
                Suggestion(id="s1", text="Add dark mode support", impact="medium"),
                Suggestion(id="s2", text="Add export to Markdown", impact="low"),
                Suggestion(id="s3", text="Add 1-click prompt copy", impact="high"),
            ],
            first_prompt=profile["first_prompt"],
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
