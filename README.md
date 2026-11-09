# Sutra

> **Say the idea. Skip the rambling.**  
> A voice-first idea-to-plan engine crafted for builders who brainstorm in Hindi, Hinglish, and English. Powered by **Gnani AI** (Prisma STT + Timbre TTS) and **Groq**.

Built for the **Gnani Great Indian AI Internship Challenge**.

---

## Architecture Overview

```
apps/
  api/                    # FastAPI backend: routers, services, adapters, store, schemas
    app/
      adapters/           # Gnani AI (Prisma STT & Timbre TTS) and Groq LLM
      prompts/            # Clarify, Plan, Refine prompts with Pydantic V2 schemas
      routers/            # REST and WebSocket API endpoints
      services/           # Session, Plan, Voice, and Usage orchestration
      store/              # Atomic JSON document store with asyncio locking
    tests/                # Comprehensive pytest suite (unit, integration, mock)
data/                     # Runtime JSON documents & TTS cache (gitignored)
docs/                     # Decisions, Voice handling, Usage stats, Submission pack
scripts/                  # Live smoke and automation scripts
```

---

## Quickstart

### 1. Prerequisites
- Python 3.11+
- Virtual environment with dependencies installed

### 2. Environment Setup
Copy the example environment file and configure your API keys:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```ini
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GNANI_API_KEY=your_gnani_api_key_here
GNANI_BASE_URL=https://api.vachana.ai
```

### 3. Run Backend API Server
```bash
# Activate virtual environment
source apps/api/.venv/bin/activate

# Run FastAPI server
uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **Health Check:** `http://localhost:8000/api/health`

### 4. Run Test Suite
```bash
PYTHONPATH=. apps/api/.venv/bin/pytest apps/api/tests/ -v
```

---

## API Surface

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health and brand status check |
| `POST` | `/api/sessions` | Create new idea intake session and generate 1-2 clarifying questions |
| `POST` | `/api/sessions/{id}/answers` | Submit answers to clarifying questions |
| `POST` | `/api/sessions/{id}/plan` | Synthesize structured engineering plan |
| `GET` | `/api/plans` | List saved plans scoped to `X-Device-Id` |
| `GET` | `/api/plans/{id}` | Retrieve complete plan and version history |
| `POST` | `/api/plans/{id}/refine` | Refine plan via suggestion ("dark mode bhi add karo") |
| `GET` | `/api/plans/{id}/export.md` | Export plan as Markdown including AI coding agent prompt |
| `DELETE` | `/api/plans/{id}` | Delete a specific plan |
| `DELETE` | `/api/data` | Delete all sessions and plans for the requesting device |
| `POST` | `/api/tts` | Synthesize speech from text via Gnani Timbre (with SHA-256 caching) |
| `POST` | `/api/stt` | Transcribe audio file via Gnani Prisma (REST fallback) |
| `WS` | `/ws/stt` | Realtime streaming speech-to-text WebSocket relay (16kHz PCM) |
| `GET` | `/api/usage` | Usage and credit counters for Gnani and Groq |
