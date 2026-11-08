# SPEC_SCHEMA.md

Contracts for the Spec document, readiness scoring, and API payloads. Pydantic models in `apps/api/app/schemas/` are the source of truth; JSON Schema and TypeScript types in `packages/spec-schema/` are generated from them. Never hand-edit generated files.

## 1. Spec JSON

```jsonc
{
  "schema_version": "1.0",
  "title": "Clinic Slots",
  "tagline": "Request-and-approve booking for a two-therapist physio clinic.",
  "problem": {
    "statement": "string, 1-3 sentences",
    "narrow_user": "string, one specific person, not a segment",
    "why_now": "string | null"
  },
  "core_loop": [
    { "step": 1, "actor": "patient", "action": "picks a slot", "outcome": "request created" }
  ],
  "scope": {
    "must": ["string"],
    "should": ["string"],
    "wont_now": ["string"],           // explicit cuts, each with reason
    "cut_line": "string"              // the one sentence defining v1 boundary
  },
  "user_stories": [
    { "id": "US1", "as_a": "patient", "i_want": "...", "so_that": "...", "priority": "must|should" }
  ],
  "data_model": {
    "entities": [
      { "name": "Slot", "fields": [{ "name": "starts_at", "type": "timestamptz", "required": true, "notes": "" }],
        "relations": ["Therapist 1:N Slot"] }
    ]
  },
  "screens": [
    { "name": "Request page", "purpose": "...", "states": { "empty": "", "loading": "", "error": "", "success": "" } }
  ],
  "edge_cases": [ { "case": "string", "handling": "string" } ],
  "acceptance_criteria": [
    { "id": "AC1", "given": "...", "when": "...", "then": "...", "story": "US1" }
  ],
  "first_prompt": "string, <= 2,500 chars, self-contained, ends with explicit 'do not build' list",
  "decisions": [
    { "topic": "booking.approval", "final": "owner approves via WhatsApp",
      "superseded": ["owner approves in dashboard"],
      "evidence": [{ "start": 412, "end": 468 }] }
  ],
  "assumptions": [
    { "id": "A1", "statement": "string", "risk": "low|medium|high", "status": "open|confirmed|rejected" }
  ],
  "open_questions": ["string"]
}
```

Validation rules (enforced by Pydantic validators, not just prompts):
- `core_loop` has 3 to 7 steps. `scope.wont_now` has at least 1 entry.
- Every `acceptance_criteria[*].story` references an existing `user_stories[*].id`.
- Every `must` user story is covered by at least one acceptance criterion.
- `first_prompt` is non-empty and contains a "Do not build" section.
- IDs unique within their list.
- No section may be an empty list except `open_questions`.

## 2. Readiness score (deterministic, 0-100)

Computed in `pipeline/score.py`. Never produced by an LLM.

| Component | Points | Full credit when |
|---|---|---|
| Narrow user | 15 | `narrow_user` is non-empty and not a generic segment (fails on "everyone", "users", "people") |
| Core loop | 15 | 3-7 steps, each with actor, action, outcome |
| Scope and cut line | 15 | has `cut_line`, >=1 `must`, >=1 `wont_now` |
| Data model | 10 | >=1 entity with >=2 fields, relations referenced entities exist |
| Edge cases | 10 | >=3 entries, scaled linearly below |
| Acceptance criteria | 15 | every must story covered; scaled by coverage |
| Screens and states | 10 | each screen has all four states described |
| First prompt | 10 | present, within length, has "Do not build" |
| Penalty: open high-risk assumptions | -5 each, max -20 | |
| Penalty: unanswered questions at compile | -3 each, max -9 | |

Result returned as `{ "score": 88, "breakdown": [{"component": "...", "earned": 12, "max": 15, "reason": "..."}] }`. The UI shows the breakdown, never just the number.

## 3. Pipeline payloads

```jsonc
// POST /v1/sessions/{id}/transcripts
{ "text": "string 1..12000", "source": "typed|wispr|browser_stt|upload", "lang_hint": "auto|en|hi|hi-Latn" }

// SSE events from /analyze and /compile
{ "event": "stage", "data": { "stage": "normalize|extract|resolve|gaps|compile|score", "status": "started|done|failed", "ms": 420 } }
{ "event": "result", "data": { /* AnalyzeResult or CompileResult */ } }

// AnalyzeResult
{
  "final_intent": { "summary": "string", "decisions": [ /* Decision */ ] },
  "revision_trace": [ { "topic": "...", "steps": [ { "value": "...", "stance": "assert|revise|retract|tentative", "span": {"start":0,"end":0}, "superseded": true } ] } ],
  "assumptions": [ /* Assumption */ ],
  "questions": [ { "id": "Q1", "text": "...", "why_it_matters": "...", "impact": 1, "options": ["..."] } ],
  "language": { "detected": ["en", "hi-Latn"], "mixed": true }
}

// POST /v1/sessions/{id}/answers
{ "answers": [ { "question_id": "Q1", "body": "string 1..1000" } ] }

// CompileResult
{ "spec_version_id": "uuid", "version": 3, "spec": { /* Spec */ }, "markdown": "string", "readiness": { /* above */ } }
```

## 4. Error format (RFC 7807)

```json
{ "type": "https://voxspec.dev/errors/pipeline-extract-failed", "title": "Extraction failed",
  "status": 502, "code": "PIPELINE_EXTRACT_FAILED", "detail": "Provider returned invalid structure after retry.", "request_id": "..." }
```

Stable codes: `VALIDATION_ERROR` (422), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `RATE_LIMITED` (429), `PIPELINE_EXTRACT_FAILED` (502), `PIPELINE_COMPILE_FAILED` (502), `PROVIDER_UNAVAILABLE` (503), `TRANSCRIPT_TOO_LONG` (413).

## 5. Markdown rendering

`pipeline/render.py` renders the Spec to Markdown with fixed headings in this order:
`# {title}`, `## 1. Problem and narrow user`, `## 2. Core loop`, `## 3. Scope and cut line`, `## 4. User stories`, `## 5. Data model`, `## 6. Screens and states`, `## 7. Edge cases`, `## 8. Acceptance criteria`, `## 9. First agent prompt`, then `## Decisions and revisions`, `## Assumptions`, `## Open questions`. Rendering is a pure function with snapshot tests.

## 6. Agent bundle (ZIP)

```
SPEC.md
ARCHITECTURE.md        generated from spec.data_model + scope (skeleton the agent refines)
ACCEPTANCE.md
AGENTS.md              rules block for the target agent
FIRST_PROMPT.md        agent-specific phrasing (antigravity | claude-code | cursor)
spec.json              machine-readable
```
