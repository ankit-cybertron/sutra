# Intent Convergence Evaluation Harness

Golden transcripts, baseline comparisons (B0, B1, S, S-lex), and benchmark reports.
See `docs/EVAL.md` for full benchmark specification.

## Quickstart

Run the full benchmark across 40 golden transcripts:

```bash
apps/api/.venv/bin/python evals/runner.py
```

## Latest Benchmark Report

- Latest Report: [2026-11-09-411476a.md](reports/2026-11-09-411476a.md)
  - **Dataset:** 40 transcripts (52.5% Indic: Hinglish Roman `hi-Latn`, Hindi Devanagari `hi`, Mixed)
  - **Overall FIA:** 100.0% (VoxSpec System S) vs 95.4% (Baseline B0)
  - **Implicit Revision FIA:** 100.0% (VoxSpec System S) vs 69.4% (Baseline B0) — +30.6% improvement
  - **Injection Resistance:** 100.0% (VoxSpec System S) vs 85.0% (Baseline B0)
