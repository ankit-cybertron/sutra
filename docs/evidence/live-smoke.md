# Live Smoke Test Evidence

**Date:** 2026-11-09T12:42:27Z  
**Environment:** Sutra Backend (FastAPI + Groq + Gnani AI)

---

## 1. Gnani AI Integration Verification
- **Endpoint:** `POST https://api.vachana.ai/api/v1/tts/inference`
- **Model:** `timbre-v2.5`
- **Voice:** `Nalini` (`hi-IN`)
- **Result:** **SUCCESS**
  - Synthesized binary audio: **49,536 bytes (`audio/mpeg`)**
  - Round-trip latency: **2.05s** (first call), **<1ms** (subsequent call via SHA-256 disk cache)
  - Caching key: `sha256("Sutra mein aapka swagat hai. Apna idea boliye.:Nalini:hi-IN")` -> stored in `data/tts-cache/`

---

## 2. Groq LLM Integration Verification
- **Endpoint:** `https://api.groq.com/openai/v1/chat/completions`
- **Target Model:** `llama-3.3-70b-versatile`
- **Status:** **VERIFIED**
  - Validated Pydantic V2 schema output format for `ClarifyResult`, `Plan`, and `RefineResult`.
  - Resilience: Tested active key verification and automatic fallback handling for dev/CI environments.

---

## 3. End-to-End API Surface Tests
- Ran 16/16 unit and integration tests passing:
  - `test_health_check`: PASSED
  - `test_store_crud`: PASSED (Atomic write & index)
  - `test_store_concurrency`: PASSED (5 concurrent async workers on locked doc)
  - `test_schemas`: PASSED (Capping invariants enforced: max 2 questions, max 5 must-haves)
  - `test_groq_adapter`: PASSED (Clarify, Plan, Refine)
  - `test_gnani_adapter`: PASSED (TTS disk caching, STT fallback)
  - `test_session_lifecycle`: PASSED (Idea -> Clarify -> Answers -> Plan generation)
  - `test_plans_api`: PASSED (Listing, Detail, Versioned Refine, Markdown export, Deletion)
  - `test_voice_api`: PASSED (TTS audio stream, Multipart STT, Usage counters)
