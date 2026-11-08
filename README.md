# VoxSpec

**Speak the messy idea. Ship the contract.**

VoxSpec turns a rambling, self-correcting, code-mixed (English / Hindi / Hinglish) voice or text brain-dump into a **build-ready specification** for an AI coding agent. Unlike a chat reply, the output is a versioned document with a fixed, validated shape: problem, narrow user, core loop, scope and cut line, data model, screens, edge cases, acceptance criteria, and a first agent prompt.

It is inspired by Spec Whisper (spec-whisper.vercel.app) and goes further:

| Spec Whisper | VoxSpec |
|---|---|
| Single-shot, browser-local history | Workspaces, projects, **versioned specs with diffs**, Supabase auth + RLS |
| LLM decides the "final intent" | **Intent Convergence**: LLM extracts claims, deterministic resolver decides the final intent, with a visible **revision trace** |
| Readiness score | **Deterministic, explainable readiness rubric** (no vibes) |
| One spec.md | **Agent bundle**: `SPEC.md`, `ARCHITECTURE.md`, `AGENTS.md`, `ACCEPTANCE.md`, first prompt, per-agent variants (Antigravity, Claude Code, Cursor) |
| English-first | **Indic-aware**: Hindi / Hinglish disfluency and revision markers |
| No quality measurement | **Eval harness** with golden transcripts and a published metric (Final-Intent Accuracy) |

## Stack

Next.js (TypeScript, Tailwind) · FastAPI (Pydantic v2) · Supabase Postgres + Auth + RLS · Docker · pluggable LLM and STT providers.

## Repo map

```
README.md              this file
ARCHITECTURE.md        system design, pipeline contracts, repo layout  <- start here
AGENTS.md              rules every coding agent must follow in this repo
docs/PRD.md            product requirements, personas, scope, cut line
docs/SPEC_SCHEMA.md    the Spec JSON contract, readiness rubric, API contract
docs/DESIGN.md         UI/UX system and screens
docs/SECURITY.md       threat model and controls
docs/TESTING.md        test pyramid, Playwright flows, CI gates
docs/EVAL.md           research angle: Intent Convergence benchmark
docs/ROADMAP.md        phases, 48-hour demo slice, post-MVP
docs/adr/              architecture decision records
supabase/migrations/   SQL schema with RLS
prompts/               Antigravity master prompt
.env.example           environment variables
docker-compose.yml     local dev topology
```

## Quick start (after the agent has built it)

```bash
cp .env.example .env
supabase start                 # local Postgres + Auth
docker compose up --build      # api on :8000, web on :3000
```

## Status

Planning bundle only. Implementation is driven by `prompts/ANTIGRAVITY_PROMPT.md`.
