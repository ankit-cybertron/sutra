# ROADMAP.md

Phases are sequential. Each has an exit gate; do not start the next phase until the gate passes. The agent keeps this file current (deferred items, findings).

## Time-boxed demo slice

Submission deadline noted for **Nov 10, 2026**. Phases 0 to 4 plus a minimal Phase 6 form the demo slice. If time runs out, cut from the bottom of `docs/PRD.md` section 8, never the revision trace or the eval harness.

| Phase | Target | Content |
|---|---|---|
| 0 | ~2 h | Foundation |
| 1 | ~2 h | Database and auth |
| 2 | ~5 h | Pure pipeline core |
| 3 | ~5 h | API, adapters, SSE |
| 4 | ~8 h | Web workspace UI |
| 6 (min) | ~4 h | 40-transcript eval, baseline vs system report |
| 5, 7 | remaining | Hardening, deploy, demo polish |

## Phase 0: Foundation
- Monorepo scaffolding per `ARCHITECTURE.md` section 7.
- `apps/api` FastAPI skeleton with `/healthz`, `/readyz`, config via pydantic-settings, structured logging, problem+json errors.
- `apps/web` Next.js skeleton with tokens and theme toggle from `DESIGN.md`.
- Dockerfiles (multi-stage, non-root, healthchecks) and `docker-compose.yml`.
- CI workflow with all gates stubbed to real commands.
- **Exit:** `docker compose up` serves both apps; CI green; ADRs 0001-0003 present.

## Phase 1: Database and auth
- Apply `supabase/migrations/0001_init.sql`.
- Magic-link auth in web; JWT verification in API.
- RLS tests: cross-user denial on every table.
- **Exit:** RLS test suite green; sign-in works end to end.

## Phase 2: Pure pipeline core
- Pydantic schemas for Spec, Claim, Decision, Assumption, Question.
- `normalize`, `resolve`, `score`, `render` with unit and property tests.
- `fake` LLM provider with fixtures.
- **Exit:** `pipeline/` coverage >= 95%; all resolver invariants pass.

## Phase 3: API, adapters, SSE
- LLM adapters (one real provider plus fake), prompt files with versions, repair retry.
- Routers and services for projects, sessions, transcripts, analyze, answers, compile, export.
- SSE stage events, rate limiting, idempotency key.
- **Exit:** integration tests green; one real-provider smoke test run manually and recorded.

## Phase 4: Web workspace
- Landing, auth, projects, workspace, intent panel with revision trace, spec viewer, export dialog.
- All states per `DESIGN.md`; verify with `webapp-testing`.
- **Exit:** Playwright flows 1, 2, 3 pass on desktop and mobile; screenshots in `docs/evidence/ui/`.

## Phase 5: Hardening
- Run `code-review` and `security-review`; fix findings.
- Remaining Playwright flows; axe clean; CSP and headers.
- **Exit:** `docs/SECURITY.md` checklist all checked.

## Phase 6: Evaluation
- `evals/` runner, golden set (>= 40, aim 120), baselines B0, B1, system S, ablation.
- Report committed and linked from README.
- **Exit:** reproducible report with limitations section.

## Phase 7: Deploy and polish
- Deploy web and API; environment docs; demo script and seed data; README with GIF/screens and benchmark summary.
- **Exit:** public URL works, demo script rehearsed.

## Post-MVP backlog
- Version diff polish, assumption ledger recompile (F9, F11).
- ZIP bundle variants, OAuth providers.
- Browser STT, server STT with Indic-capable provider.
- Public share links, teams, audio capture with explicit consent.
- Second annotator and agreement stats for the benchmark.

## Deferred items log
(Agent appends here: item, reason, phase it was deferred from.)
