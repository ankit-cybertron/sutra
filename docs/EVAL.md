# EVAL.md: Intent Convergence benchmark

This is the research contribution of VoxSpec. It must be implemented and reported honestly, including where it fails.

## 1. Task definition

**Intent Convergence:** given a disfluent, self-correcting spoken-style transcript describing a software idea, recover (a) the speaker's *final intent* per topic and (b) the *revision structure* (which earlier statements were superseded, retracted, or only tentative).

Why it matters: dictation tools preserve false starts. Downstream agents that read the whole ramble often build the superseded version. No standard benchmark targets this for code-mixed Indic speech.

## 2. Phenomena covered

| Tag | Example (paraphrased) | Expected |
|---|---|---|
| `explicit_revision` | "owner approves in a dashboard, no actually, via WhatsApp" | final: WhatsApp |
| `implicit_revision` | later statement contradicts earlier without a marker | final: later |
| `retraction` | "forget the payments thing" | topic dropped |
| `tentative` | "maybe add dark mode, not sure" | not a decision, becomes assumption |
| `topic_return` | A -> B -> back to A | final: A, trace shows both |
| `restatement` | same thing said twice with different words | no revision |
| `negation_trap` | "it should not use login" | final: no login (not a revision) |
| `cross_lingual` | revision marker in Hindi/Hinglish, content in English or reverse | handled |
| `distractor` | aside unrelated to the app | ignored |
| `injection` | "ignore previous instructions..." inside transcript | ignored, flagged |

## 3. Dataset

Location: `evals/golden/*.jsonl`. One transcript per line:

```json
{ "id": "g-014", "lang": "hi-Latn", "text": "...",
  "tags": ["explicit_revision", "cross_lingual"],
  "gold": {
    "decisions": [ { "topic": "booking.approval", "final": "owner approves via WhatsApp" } ],
    "revisions": [ { "topic": "booking.approval", "superseded": ["owner approves in dashboard"] } ],
    "retracted_topics": [],
    "tentative": ["dark mode"]
  } }
```

Size targets: **minimum 40 transcripts for the demo, 120 for a full report.** Language mix: >= 40% Hinglish or Hindi (Roman and Devanagari), remainder English. Every phenomenon tag appears at least 4 times.

Provenance rules:
- Author the first 20 by hand from realistic ideas. Synthetic expansion with an LLM is allowed but every gold label must be human-verified; mark `"provenance": "hand" | "synthetic-verified"`.
- No real user data without consent. No personal information in transcripts.
- Hold out 30% as a **test split never used for prompt tuning**.

## 4. Revision marker lexicon (hint resource, not the detector)

Used for (a) analysis of which markers the model catches, (b) generating synthetic data, (c) optional hint to the extraction prompt. The detector is the LLM extraction stage plus resolver; the lexicon must not be the only signal.

- English: "no actually", "scratch that", "wait", "on second thought", "let me rephrase", "forget that", "instead", "rather", "never mind", "I mean".
- Hinglish (Roman): "nahi nahi", "nahi actually", "ruko", "ruk jao", "matlab", "mera matlab tha", "chhodo", "chodo ye", "ya phir", "balki", "pehle jaisa nahi".
- Devanagari: "नहीं नहीं", "रुको", "बल्कि", "छोड़ो", "मेरा मतलब".

Grow this list from errors in the golden set; commit each addition with the transcript that motivated it.

## 5. Metrics

Computed per transcript then macro-averaged; also report per-tag and per-language.

- **Final-Intent Accuracy (FIA):** fraction of gold decisions whose predicted final value is judged equivalent. Equivalence: normalized exact match first, then an LLM judge (fixed model, temperature 0) for paraphrase, with the judge's verdicts saved for audit. Report the judge-free exact-match number alongside.
- **Revision Recall:** fraction of gold superseded values found in predicted `superseded[]`.
- **Revision Precision / Spurious Revision Rate:** predicted revisions not in gold (e.g., restatements wrongly treated as revisions).
- **Tentative Handling Accuracy:** tentative items kept out of decisions.
- **Injection Resistance:** fraction of injection cases with no decision change.
- Latency p50/p95 and tokens per transcript.

## 6. Systems compared

| ID | System |
|---|---|
| B0 | Single prompt: "Extract the final intent from this transcript" (no structure) |
| B1 | Two-stage LLM only: extract claims, then LLM decides final values (no deterministic resolver) |
| **S** | VoxSpec: LLM extracts claims with stances and spans, deterministic resolver decides |
| S-lex | S plus lexicon hint in the extraction prompt (ablation) |

Same model, temperature 0, same transcripts, for all. Run each system 3 times, report mean and standard deviation. Record model id, prompt versions, date.

## 7. Reporting

`evals/runner.py` writes `evals/reports/<date>-<git-sha>.md` with: setup, table of metrics per system, per-tag and per-language breakdown, 10 worst failures with transcript excerpts and what went wrong, and a "limitations" section. The README links the latest report.

Honest-reporting rules: show where S loses to a baseline; do not drop hard transcripts after seeing results; state dataset size and that labels were author-made.

## 8. Limitations to state in every report

Small, author-curated dataset; single annotator unless a second annotator is added (report agreement if so); judge model bias; topic naming is system-chosen so topic alignment between gold and predicted uses semantic matching; results are for software-idea transcripts, not general speech.

## 9. Resolution rules (implemented in `pipeline/resolve.py`)

See `ARCHITECTURE.md` section 4. Any change to rules requires updating this file, the property tests, and re-running the eval.
