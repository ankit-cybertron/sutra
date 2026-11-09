# ADR 0004: Default LLM (Groq) and STT (Gnani.ai) Provider Selection

- Status: Accepted
- Date: 2026-11-09

## Context
VoxSpec requires ultra-low-latency structured output generation to enable interactive intent extraction and spec compilation. Furthermore, transcripts often feature Hindi, English, and code-mixed Hinglish phrases with sudden self-corrections ("ruko nahi, matlab WhatsApp se notify karo"), making general Western-centric ASR models less accurate on Indian accents and code-mixed phonetic shifts.

## Decision
1. **Primary LLM Provider: Groq API**
   - Implemented via `apps/api/app/llm/groq.py` using `httpx.AsyncClient` directly hitting Groq's OpenAI-compatible completions endpoint (`https://api.groq.com/openai/v1/chat/completions`).
   - Default model: `llama-3.3-70b-versatile` (or `llama-3.1-8b-instant`).
   - Leverages Groq LPUs for near-instant token generation (<400ms for claim extraction), strict JSON response format (`response_format={"type": "json_object"}`), and one automatic repair retry on schema violation.

2. **Speech-to-Text (STT) Provider: Gnani.ai**
   - Implemented via `apps/api/app/stt/gnani.py` under `STTProvider` protocol.
   - Endpoint: `https://api.vachana.ai/stt/v3` (Prisma STT).
   - Specialized for Indic languages (Hindi, Kannada, Tamil, Telugu, Marathi, Gujarati) and code-mixed Hinglish.
   - Accepts audio payloads (WAV/MP3/M4A/WebM) via `multipart/form-data` with `X-API-Key-ID` header.
   - Also provides a deterministic `fake` STT provider for CI, offline testing, and browser automation.

## Consequences
- Fast response times: SSE stages complete in seconds, providing a snappy studio console experience.
- High accuracy on code-mixed Hinglish and regional terminology.
- Clean separation: All pipeline code remains provider-agnostic via `LLMProvider` and `STTProvider` protocols.
- CI/Testing continues to use `fake` providers with 100% deterministic reproducibility.
