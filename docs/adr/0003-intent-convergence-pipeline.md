# ADR 0003: Intent Convergence as extract-then-resolve

- Status: Accepted
- Date: 2026-11-08

## Context
A single prompt asked to "find the final intent" is opaque, hard to test, and inconsistent on long, self-correcting, code-mixed transcripts. Users need to see why a decision was made.

## Decision
Split into: (1) LLM extracts atomic claims with topic, stance (assert, revise, retract, tentative), evidence span, and language; (2) a deterministic resolver computes final decisions and the revision trace; (3) readiness is a deterministic rubric. The resolver rules are documented in `docs/EVAL.md` and covered by property tests.

## Consequences
- Core logic is unit and property testable; LLM variance is isolated to claim extraction.
- UI can show an auditable revision trace tied to transcript spans.
- Quality is measurable against baselines (B0, B1) on a golden set.
- Risk: topic naming drift across claims. Mitigation: extraction prompt receives a running topic list; resolver groups by normalized topic; eval measures topic alignment.
