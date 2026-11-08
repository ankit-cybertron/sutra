# Antigravity master prompt: build VoxSpec

Paste everything below the line into Antigravity (Planning mode). Run from the repo root (`gnani_project/`, or wherever you copied this bundle).

---

You are the lead engineer building **VoxSpec**, a voice-first build-brief application: it turns a messy, self-correcting, code-mixed (English / Hindi / Hinglish) dictated or typed ramble into a validated, versioned, build-ready spec for AI coding agents. The product is inspired by Spec Whisper but is a more mature, professional product with its own UI and a measurable research contribution (Intent Convergence).

## 0. Ground rules

1. Before writing any code, read in this order: `AGENTS.md`, `README.md`, `docs/PRD.md`, `ARCHITECTURE.md`, `docs/SPEC_SCHEMA.md`, `docs/DESIGN.md`, `docs/SECURITY.md`, `docs/TESTING.md`, `docs/EVAL.md`, `docs/ROADMAP.md`, `docs/adr/*`, `supabase/migrations/0001_init.sql`, `.env.example`.
2. Skills are installed in `.agents/skills/`. Read the relevant `SKILL.md` **before** each kind of work, as mapped in `AGENTS.md`. Name the skill you are applying when you start each phase.
3. Work phase by phase exactly as in `docs/ROADMAP.md`. Do not start a phase until the previous exit gate passes. Produce a short plan artifact at the start of each phase and a verification summary at the end.
4. The docs are the contract. If you find a contradiction or a better approach, write an ADR in `docs/adr/` and update the affected docs in the same change. Never silently diverge.
5. No stubs presented as done. No placeholder implementations. If something must be deferred, log it in `docs/ROADMAP.md` under "Deferred items log".
6. Do not ask me questions unless blocked by a missing secret, an irreversible decision, or a contradiction you cannot resolve. Make reasonable choices, record them.
7. Commit after every logical unit with conventional commit messages.
8. Time matters: I have a hard deadline. Phases 0 to 4 and a minimal Phase 6 are the **demo slice**. Reach a demoable vertical slice (paste ramble -> intent with revision trace -> questions -> compiled spec -> export) as early as possible, then harden.

## 1. Product in one paragraph

User pastes or dictates (Wispr Flow types into our textarea) a ramble. Pipeline: normalize -> **LLM extracts claims** (topic, stance assert/revise/retract/tentative, evidence span, language) -> **deterministic resolver** decides final intent and builds a revision trace -> gap analysis produces assumptions and at most 3 high-impact questions -> after answers, compile a Spec JSON validated against the schema -> deterministic readiness score and Markdown render -> export (SPEC.md, first prompt, agent bundle). Signature UI: the **revision trace** ("what changed your mind") linked to transcript spans. Signature research artifact: the **eval harness** comparing baselines against our extract-then-resolve method.

## 2. Phases

### Phase 0: Foundation (skills: `architecture-patterns`, `docker-patterns`, `documentation-and-adrs`)
- Create the monorepo layout from `ARCHITECTURE.md` section 7.
- `apps/api`: FastAPI app factory, `/healthz`, `/readyz`, pydantic-settings config validated at boot, structured JSON logging with request ids, RFC 7807 error handler with the stable codes in `docs/SPEC_SCHEMA.md`, CORS from env.
- `apps/web`: Next.js App Router, TypeScript strict, Tailwind, design tokens from `docs/DESIGN.md` (light and dark), fonts via `next/font`, theme toggle.
- Dockerfiles: multi-stage, pinned base images, non-root, healthchecks, `.dockerignore`. Make `docker-compose.yml` work.
- GitHub Actions CI implementing all gates in `docs/TESTING.md` section 5 (gates that need later phases may run empty suites but must be wired).
- Exit gate: `docker compose up` serves both apps; CI config valid; `/healthz` returns 200.

### Phase 1: Database and auth (skills: `supabase-postgres-best-practices`, `security-review`, `fastapi-expert`)
- Review `supabase/migrations/0001_init.sql` critically against the skill. Fix issues via a new migration, never by editing applied history once applied. If you find a flaw before first apply, you may amend and note it in an ADR.
- Supabase magic-link auth in the web app. JWT verification in the API (signature via JWKS, `exp`, `aud`, `iss`); queries run in the user's JWT context so RLS applies.
- Write the RLS test suite: for every table, user B cannot select, insert-with-A's-parent, update, or delete user A's rows; child rows cannot point at another user's parent.
- Exit gate: RLS suite green; sign-in works end to end.

### Phase 2: Pure pipeline core (skills: `architecture-patterns`, `systematic-debugging`)
- Pydantic models for `Spec`, `Claim`, `Decision`, `RevisionTrace`, `Assumption`, `Question` per `docs/SPEC_SCHEMA.md`, with all validation rules as validators. Generate JSON Schema and TS types into `packages/spec-schema/`.
- Implement `normalize`, `resolve`, `score`, `render` as pure functions in `app/pipeline/`.
- Resolver follows the rules in `ARCHITECTURE.md` section 4 and `docs/EVAL.md` section 9.
- Implement the `fake` LLM provider with fixtures keyed by input hash.
- Tests: unit, snapshot (render), and hypothesis property tests for all six invariants in `docs/TESTING.md` section 2.
- Exit gate: `pipeline/` coverage >= 95%, all invariants pass.

### Phase 3: API, adapters, streaming (skills: `fastapi-expert`, `research`, `security-review`, `supabase-postgres-best-practices`)
- Use the `research` skill to pick the current structured-output mechanism for one real provider (default choice: whichever API key I have set in `.env`; if none, implement against Anthropic and keep the adapter interface clean). Record the choice in `docs/adr/0004-default-provider.md`.
- Adapters: `anthropic`, `openai`, `gemini` (at least one real, others behind the same interface with tests against recorded fixtures), plus `fake`.
- Prompts as versioned files in `app/pipeline/prompts/`: claim extraction (with injection-resistant delimiters, no tools), gap analysis, compile. One repair retry on schema violation.
- Routers and services for every endpoint in `ARCHITECTURE.md` section 6. SSE stage events for analyze and compile. Per-user rate limits, daily token budget, idempotency key on compile, transcript length cap.
- Integration tests with ephemeral Postgres.
- Exit gate: integration suite green; run one real-provider smoke test and save the output to `docs/evidence/smoke-real-provider.md` with secrets redacted.

### Phase 4: Web workspace (skills: `frontend-design`, `webapp-testing`, `code-review`)
- Build the screens in `docs/DESIGN.md` section 5 with all four states each: landing, auth, projects, workspace (Talk), intent panel (final intent, **revision trace with evidence-span linking**, assumptions, questions), spec viewer (9 sections, readiness ring with breakdown, version switcher, diff), export dialog, settings with delete-all-data.
- The design must be clearly distinct from Spec Whisper. Follow the "Studio console" concept and tokens. Use `frontend-design` for craft; do not use generic template looks.
- Sanitized Markdown rendering, CSP, accessible by keyboard, reduced-motion support.
- Verify in a real browser with `webapp-testing`: Playwright flows 1, 2, 3 from `docs/TESTING.md` on desktop and a 390px viewport, using the `fake` provider. Save screenshots to `docs/evidence/ui/`.
- Exit gate: flows pass, screenshots committed, axe has zero serious violations on main screens.

### Phase 5: Hardening (skills: `code-review`, `security-review`, `systematic-debugging`)
- Run `code-review` over the whole repo; fix or log findings.
- Run `security-review` against the checklist in `docs/SECURITY.md`; every box must be checked with evidence or a logged deferral.
- Remaining Playwright flows 4 to 8.
- Exit gate: SECURITY checklist complete.

### Phase 6: Evaluation (skills: `research`, `documentation-and-adrs`)
- Build `evals/` per `docs/EVAL.md`: golden set with at least 40 transcripts (>= 40% Hinglish/Hindi, every phenomenon tag >= 4 times, 30% held-out test split), runner for systems B0, B1, S and S-lex, metrics FIA / Revision Recall / Spurious Revision Rate / Tentative Handling / Injection Resistance, three runs each.
- Hand-write the first 20 transcripts from realistic app ideas. For the rest you may generate synthetic transcripts, but mark `provenance` and list in the report which labels I must verify. Do not fabricate results: run the real systems and report real numbers, including where S loses.
- Commit the report to `evals/reports/` and link it from `README.md`. Include the limitations section.
- Exit gate: reproducible report with honest limitations.

### Phase 7: Deploy and polish (skills: `docker-patterns`, `documentation-and-adrs`, `frontend-design`)
- Production configs for web and API, environment documentation, seed/demo data, demo script in `docs/DEMO.md`, README with screenshots and benchmark summary.
- Exit gate: production build runs locally in containers from a clean clone using only README steps.

## 3. Quality bar (applies to every phase)

- Types strict everywhere, lint clean, tests meaningful (not just coverage).
- Layering per `ARCHITECTURE.md`; `pipeline/` has zero I/O.
- LLM extracts, code decides. Never let a model compute the readiness score or pick between conflicting claims.
- Never log transcript or spec content above DEBUG. Never commit secrets.
- Every data view has empty, loading, and error states.

## 4. How to report back

At the end of each phase output: (1) what was built, (2) how it was verified with file paths to evidence, (3) deferred items and why, (4) the next phase's plan. At the very end output a final README-ready summary and a list of anything I must do manually (secrets, deploy accounts, label verification).

Begin with Phase 0. First, produce your plan artifact for Phase 0, then execute it.
