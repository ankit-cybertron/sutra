# Integration Notes: UI Contract & Backend Synchronization

**Date:** 2026-11-10  
**Context:** Merging React frontend (`apps/web/`) with FastAPI backend (`apps/api/`) in strict compliance with `apps/web/docs/API_CONTRACT.md` and `apps/web/src/api/types.ts`.

---

## 1. Mismatch & Alignment Table

| Endpoint / Area | UI Contract Expects (`API_CONTRACT.md` & `types.ts`) | Backend Currently Does | Action Taken |
|---|---|---|---|
| **JSON Field Casing** | Strict `camelCase` across all schemas (`sessionId`, `detectedLang`, `displayText`, `spokenText`, `mustHave`, `oneLiner`, `targetUser`, `buildOrder`, `techNotes`, `openQuestions`, `firstPrompt`, `changeSummary`, `spokenReply`). | `snake_case` models (`session_id`, `detected_language`, `display_text`, etc.). | Apply `ConfigDict(alias_generator=to_camel, populate_by_name=True)` to all Pydantic schemas. Set `response_model_by_alias=True` so all JSON serialization uses camelCase. |
| **`POST /api/sessions`** | Request: `{idea, lang: "auto"\|"en"\|"hi"\|"hinglish", source: "voice"\|"text"}`<br>Response: `{sessionId: string, detectedLang: Lang, questions: Question[0..2]}` | Request: `{idea, lang, source}`<br>Response: `{session_id: str, questions: [...]}` (snake_case, missing `detectedLang`). | Update `CreateSessionResponse` with `sessionId`, `detectedLang`, `questions`. Enforce guardrail screening (NFC normalization, zero-width stripping, regex injection screen). |
| **`POST /api/sessions/{id}/plan`** | Request: `{answers: [{questionId, text}]}` (empty array allowed).<br>Response: `PlanDoc` (`{id, version, plan: Plan, changeSummary: string[]}`). | Had separate `POST /answers` endpoint. Plan endpoint returned `{plan_id, plan}`. | Accept `{answers: [...]}` directly in `POST /api/sessions/{id}/plan`. Return `PlanDoc` directly with `id`, `version: 1`, `plan`, `changeSummary`. Enforce `mustHave <= 5` and valid ID regex `^[\w-]+$`. |
| **`POST /api/plans/{id}/chat`** | Request: `{message, source, lang}`<br>Response: `{reply, spokenReply, plan?: PlanDoc, changeSummary: string[]}` (`plan` omitted when plan is unchanged). | Had `POST /api/plans/{id}/refine` accepting `{suggestion, source}` returning `{version, plan, change_summary}`. | Implement `POST /api/plans/{id}/chat`. Maintain last 10 chat turns per plan in store. Return conversational `reply`, `spokenReply`, and optional `plan` + `changeSummary` when architecture is modified. |
| **`GET /api/plans/{id}`** | Returns: `PlanDoc` (`{id, version, plan, changeSummary}`).<br>404 problem+json for unknown or foreign IDs. | Returned `PlanDetailResponse` wrapper with `versions` array. | Return `PlanDoc` of active version directly: `{id, version, plan, changeSummary}`. Validate ownership with `X-Device-Id`. |
| **`POST /api/tts`** | Request: `{text, lang}`<br>Response: binary `audio/mpeg` or `audio/wav`. Max 240 chars. Server-side sha256 cache. | Handled TTS with max 1000 chars and optional voice parameter. | Cap input text at 240 chars. Strip and validate text. Return cached audio with correct Content-Type header. |
| **`GET /api/health`** | Response: `{ok: true}`. | Response: `{status: "ok", app: "Sutra", ...}`. | Update response to include `ok: true`. |
| **`WS /ws/stt`** | Query: `?lang=<auto\|en\|hi\|hinglish>`.<br>Frames: 1024-byte binary PCM16 mono 16kHz + `{"type":"commit"}`.<br>Response: `transcript`, `error`, and `done` events. | Relayed audio but missed sending `{"type":"done"}` prior to close. Lacked pre-roll burst tolerance and IP concurrency locking. | Emit `{"type":"done"}` after final commit transcript. Handle pre-roll burst (~320ms). Send `{"type":"error","code":"BUSY"}` if client has another concurrent stream. |
| **Guardrails & Injections** | Normalize NFC, strip zero-width / bidi / control chars. Regex screen for injection in English & Hindi/Hinglish ("ignore instructions", "pichle nirdesh bhool jao", "reveal prompt", jailbreaks). Return 422 `INPUT_BLOCKED`. | Basic length checks only. | Implement `GuardrailService` running prior to all LLM and session operations. Return generic 422 `INPUT_BLOCKED` without revealing rule details. |
| **Rate Limiting** | Keyed by **client IP** (not spoofable device ID). Token buckets: sessions 6/min 40/day, plan 6/min 40/day, chat 20/min 200/day, tts 30/min, ws 12/min. 429 returns `code: "RATE_LIMITED"`, `retryAfter`, and `Retry-After` header. 5 blocks in 10 mins = 15-min ban. | Keyed by device ID header with simple 30/min sliding window. | Re-implement `RateLimiter` keyed by client IP with minute and daily buckets, `Retry-After` header, body `retryAfter`, and 15-minute ban on repeated blocks. |
| **Error Format (RFC 7807)** | `{type, title, status, code, detail, retryAfter?, requestId}`. Status codes: 429 (`RATE_LIMITED`), 422 (`INPUT_BLOCKED`, `INPUT_INVALID`), 413 (`INPUT_TOO_LONG`), 502/503 (`PROVIDER_UNAVAILABLE`, `VOICE_UNAVAILABLE`), 404 (`NOT_FOUND`). | RFC 7807 problem details but lacked top-level `requestId` and `retryAfter`. | Standardize `problem_response` with `requestId` (UUID) and `retryAfter` on all error payloads. |

---

## 2. Safe Mapping Decisions
- `apps/web/src/api/client.ts` remains the source of truth for frontend expectations. All alignment changes are implemented server-side in `apps/api/` to adhere strictly to Ground Rule 0.
