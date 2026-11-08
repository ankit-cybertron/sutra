# ADR 0001: Stack selection

- Status: Accepted
- Date: 2026-11-08

## Context
Solo author, tight timeline, installed agent skills for FastAPI, Supabase Postgres, Docker, and frontend design. Need a professional web app with auth, relational data, and LLM calls.

## Decision
Next.js (TypeScript) frontend, FastAPI backend, Supabase (Postgres, Auth) with RLS, Docker for local and production packaging.

## Consequences
- Python gives the best ecosystem for evals and pipeline logic; FastAPI gives typed contracts via Pydantic.
- Supabase removes auth and DB ops work; RLS gives defense in depth.
- Two deployables (web, api) instead of one; accepted for clear separation and independent scaling.
- Rejected: Next.js only with route handlers (weaker Python eval story); Django (heavier, slower to iterate); Firebase (relational model fits Postgres better).
