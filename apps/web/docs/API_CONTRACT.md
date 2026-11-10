# API contract (UI <-> backend)

The UI in this folder is finished against this contract and runs standalone on `src/api/mock.ts`.
Set `VITE_USE_MOCK=false` and the same screens talk to the real backend. Types: `src/api/types.ts` (source of truth for field names). JSON is **camelCase** (in Pydantic: `alias_generator=to_camel`, `populate_by_name=True`).

Identity: no auth. The UI sends an anonymous `X-Device-Id` (random UUID in localStorage). It scopes data but is **spoofable, so never treat it as authentication and never rely on it for rate limiting** (limit by client IP).

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/sessions` | `{idea, lang: "auto"|"en"|"hi"|"hinglish", source: "voice"|"text"}` | `{sessionId, detectedLang, questions: Question[0..2]}` |
| POST | `/api/sessions/{id}/plan` | `{answers: [{questionId, text}]}` | `PlanDoc` |
| POST | `/api/plans/{id}/chat` | `{message, source, lang}` | `{reply, spokenReply, plan?: PlanDoc, changeSummary: string[]}` |
| GET | `/api/plans/{id}` | | `PlanDoc` (used to restore `#p=<id>` after reload) |
| POST | `/api/tts` | `{text, lang}` | binary audio (`audio/mpeg`), cached server side |
| WS | `/ws/stt?lang=auto` | binary PCM frames + `{"type":"commit"}` | JSON events (below) |
| GET | `/api/health` | | `{ok:true}` |

`Question = {id, displayText, spokenText, options: string[]}` (max 2 questions; 0 only if the idea is already fully specific).
`PlanDoc = {id, version, plan: Plan, changeSummary: string[]}`. `Plan` is in `src/api/types.ts` (`mustHave` has at most 5 items).
`chat` is conversational: it may answer a question without changing the plan (`plan` absent), or change the plan (new `version`, `changeSummary` filled). Server keeps the last 10 chat turns per plan.
Suggestions that would blow the scope are accepted but moved to `later` with a one-line reason.

## Errors (RFC 7807 problem+json)

```json
{ "type": "...", "title": "...", "status": 429, "code": "RATE_LIMITED", "detail": "...", "retryAfter": 15, "requestId": "..." }
```
Also send the `Retry-After` header on 429. The UI maps `code` to messages (it never shows `detail` for blocked input):

| code | status | UI behaviour |
|---|---|---|
| `RATE_LIMITED` | 429 | warning banner with live countdown, submit buttons disabled until `retryAfter` elapses |
| `INPUT_BLOCKED` | 422 | generic "I can only help plan app ideas..." message. **Never reveal which rule fired.** |
| `INPUT_TOO_LONG` | 413 | "too long" message |
| `INPUT_INVALID` | 422 | "enter something first" |
| `PROVIDER_UNAVAILABLE` | 502/503 | "AI busy, your text is saved", input is preserved |
| `VOICE_UNAVAILABLE` | 502/503 | voice banner, text keeps working |
| `NOT_FOUND` | 404 | "plan not found" |

## WebSocket `/ws/stt` (voice)

Browsers cannot set auth headers on a WebSocket, so the browser talks only to **our** backend, which opens the Gnani socket with the key. One WS per spoken turn.

- Client -> server: binary frames of **exactly 1024 bytes** (PCM signed 16-bit LE, mono, 16 kHz, 32 ms), then text `{"type":"commit"}` after ~1.2 s of silence.
- Server -> client (JSON text): `{"type":"transcript","text","segmentId","lang"}`, `{"type":"error","code":"RATE_LIMITED"|"BUSY"|"UPSTREAM","message"}`, `{"type":"done"}` (then close).
- Server: check `Origin`, one open turn per client, max 45 s per turn, idle timeout, close upstream when the client disconnects.

## Guardrails (backend must implement; the UI only reflects them)

Treat every idea, answer and chat message (typed or transcribed) as **untrusted data**.

1. **Normalize + validate first**: NFC, strip zero-width / bidi-override / control characters, collapse whitespace, enforce limits (idea 1500 chars, answer 500, chat 500, TTS text 240), reject empty. Count characters, not bytes. Cap request body size.
2. **Deterministic injection screen** (cheap, runs before any model call): patterns for "ignore/disregard previous instructions", "reveal/print system prompt", role-play jailbreaks ("you are now ...", "developer mode"), attempts to emit tool/function calls, base64/hex blobs, and delimiter spoofing (`</user_input>`, `<|im_start|>` etc.). Include Hindi/Hinglish variants (e.g. "pichle instructions ignore karo", "पिछले निर्देश भूल जाओ"). Match on the normalized text.
3. **Model-based classifier** for what regexes miss: a small Groq call that returns strict JSON `{allowed: boolean, category: "ok"|"injection"|"malicious_build"|"abuse"|"off_topic"}`. Allowed means "a plausible app/product idea or an on-topic follow-up about the plan". Block requests to build malware, phishing, credential theft, surveillance of individuals, fraud, or sexual content involving minors. Fail **closed** on classifier error for the first message of a session, fail open only for short follow-ups already inside an approved session.
4. **Spotlighting**: pass user text to the planner inside clearly delimited data blocks with a per-request random delimiter, and tell the model the block is data, never instructions. The planner model gets **no tools, no browsing, no function calling**.
5. **Strict structured output**: Groq `json_schema` with `strict: true` (every property required, `additionalProperties: false`), then re-validate with Pydantic. Reject or repair-once; never return free text to the client as a plan.
6. **Output screening**: scan model output for a per-process **canary token** planted in the system prompt (if it appears, drop the response and log), for system-prompt fragments, and for URLs/HTML. Cap lengths. The UI renders everything as plain text, but the backend should still strip HTML.
7. **Chat limits**: last 10 turns only, max 500 chars per message, the plan document itself is the only long-lived context. A blocked message is not stored and does not count as a turn.
8. **Response on block**: HTTP 422 `INPUT_BLOCKED`, generic detail, no category, no matched rule. Log `{requestId, ipHash, category}` only (never the raw text above DEBUG).
9. Voice input goes through the exact same pipeline after transcription.

## Rate limiting (backend must implement)

Key by **client IP** (use `X-Forwarded-For` only from a trusted proxy setting), with the device id as a secondary key. In-memory token buckets behind a `RateLimiter` interface so Redis can replace it later.

| Scope | Limit |
|---|---|
| `POST /api/sessions` | 6 / min, 40 / day |
| `POST /api/sessions/{id}/plan` | 6 / min, 40 / day |
| `POST /api/plans/{id}/chat` | 20 / min, 200 / day |
| `POST /api/tts` | 30 / min (cache hits are free) |
| `/ws/stt` | 1 concurrent turn, 12 turns / min, 45 s per turn |
| Global | daily cap on Groq tokens and Gnani seconds; when hit, return `PROVIDER_UNAVAILABLE` with a friendly message (circuit breaker) |

Always return `429` + `Retry-After` + `retryAfter` in the body. Repeated `INPUT_BLOCKED` from one IP (e.g. 5 in 10 min) triggers a temporary 15-minute block with `RATE_LIMITED`.

## Dev flags in mock mode

`?mock=ratelimit` (4th call returns 429), `?mock=blocked` (everything blocked), `?mock=down`, `?mock=slow`. Typing "ignore previous instructions..." is also blocked in mock mode so the guardrail UI can be demoed offline.
