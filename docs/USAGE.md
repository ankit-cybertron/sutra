# Resource Usage & Monitoring (`USAGE.md`)

This document records resource consumption across Gnani AI and Groq LLM services during development and live smoke testing.

## Live Usage Summary (from `GET /api/usage`)

### Groq LLM API
- **Model:** `llama-3.3-70b-versatile`
- **Total API Calls:** 1+
- **Estimated Tokens Consumed:** ~500 tokens
- **Rate Limit Policy:** 10 plan generations / min; 30 session/clarify requests / min.

### Gnani AI Platform
- **STT (Prisma v3.0):**
  - REST & Stream Sessions: Monitored per turn
  - Audio Seconds Processed: Capped at 45 seconds per turn
- **TTS (Timbre v2.5):**
  - Synthesis Calls: 1 live call
  - Audio Characters: ~50 characters
  - Cache Hits: 1+ hits (100% hit rate on identical repeat queries)
  - Audio Format: MP3 (24kHz, linear PCM)

## Cost & Credit Optimization Measures Implemented
1. **TTS SHA-256 Hash Caching:** Avoids duplicate billing for identical system questions, welcome greetings, and prompts.
2. **Hard Capping:**
   - User raw idea capped at 1,500 characters.
   - Clarifying questions strictly capped at maximum 2 questions per idea.
   - Spoken question lines capped at <= 300 characters.
   - Realtime STT stream turns capped at 45 seconds max.
