# ADR 0002: LLM and STT provider abstraction

- Status: Accepted
- Date: 2026-11-08

## Context
Model quality, price, and availability change quickly; free-tier limits may hit during a demo; tests must not call the network.

## Decision
All model access goes through `LLMProvider.structured(...)` returning a validated Pydantic model, and `STTProvider.transcribe(...)`. Implementations: anthropic, openai, gemini, and a deterministic `fake`. Selected by env var. Prompts are versioned files; the version is stored with every extraction.

## Consequences
- CI, Playwright, and demo mode run on `fake` with zero cost and zero flakiness.
- Benchmarks can compare providers with identical pipeline code.
- Slight lowest-common-denominator constraint on features; acceptable because structured JSON output is all we need.
