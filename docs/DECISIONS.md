# Architectural Decisions & Log

## 2026-11-09: Backend Architecture Initialization

### 1. Brand Configuration
- **Decision:** Configured brand name as `Sutra` via `BrandConfig`, centrally manageable via environment or config file.
- **Rationale:** Ensures brand name and taglines can be rebranded without changing business logic or schema.

### 2. Document Store (`DocStore` / `JsonFileStore`)
- **Decision:** Pure JSON document storage on disk in `data/<collection>/<id>.json` behind an abstract `DocStore` interface.
- **Atomic Operations:** Uses `os.replace` via temporary files (`.tmp`) to guarantee atomicity and avoid corrupted states on power failure.
- **Concurrency:** Per-document asyncio locks (`asyncio.Lock`) in memory to serialize concurrent updates to the same document.
- **Querying:** In-memory collection index maintaining document metadata (`id`, `device_id`, timestamps, status) for low-latency `list` and filtered queries.

### 3. Groq LLM Integration & Prompt Handling
- **Decision:** Use Groq API with `llama-3.3-70b-versatile` as primary model with fallback support.
- **Structured Outputs:** Uses strict Pydantic v2 schemas and JSON mode with validation retry repair to guarantee strict adherence to schema without hallucinated structure.
- **Security:** Strict delimiter blocks (`<user_idea>...</user_idea>`) preventing prompt injections from user-supplied transcripts or typed ideas.

### 4. Gnani AI Integration (STT & TTS)
- **Realtime STT:** `WS /ws/stt` handles binary 16kHz PCM16 mono frames from frontend clients and bridges to Gnani `wss://api.vachana.ai/stt/v3/stream` with API key kept server-side.
- **REST STT Fallback:** `POST /api/stt` handles multipart audio upload for browsers with poor WebSocket stability.
- **TTS & Caching:** `POST /api/tts` uses SHA-256 hash `sha256(text + voice + lang)` caching in `data/tts-cache/` to conserve API credits.
- **Mock Mode:** `GNANI_MODE=mock` provides deterministic mocks for CI and local offline testing.

### 5. Multi-Device Scoping
- **Decision:** Scoped strictly via `X-Device-Id` header (generated client-side, stored in localStorage).
- **Rationale:** No authentication wall required for frictionless demo experience while ensuring data isolation per device.

### 6. Native AWS Elastic Beanstalk (Python 3.11) Deployment
- **Decision:** Native Python 3.11 platform on Amazon Linux 2023 with Gunicorn + Uvicorn workers (`uvicorn.workers.UvicornWorker`), removing Docker build overhead.
- **Entry Point:** `application.py` exposing `application = app` matching AWS Beanstalk conventions and configured in `Procfile`.
- **Proxy Headers:** `ProxyHeadersMiddleware` enabled to respect `X-Forwarded-Proto` and `X-Forwarded-For` from AWS Application Load Balancer (ALB).
- **Data Persistence:** Local JSON documents on EBS root volume are ephemeral across EC2 terminations. Documented migration path to Amazon EFS via `.ebextensions` or S3 storage adapter for scalable multi-instance production.
