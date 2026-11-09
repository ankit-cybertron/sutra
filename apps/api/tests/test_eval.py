"""Test suite verifying Intent Convergence evaluation dataset and system benchmarks."""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from evals.runner import evaluate_output, run_system_s

GOLDEN_PATH = REPO_ROOT / "evals" / "golden" / "transcripts.jsonl"
THRESHOLDS_PATH = REPO_ROOT / "evals" / "thresholds.json"


def test_golden_dataset_invariants() -> None:
    assert GOLDEN_PATH.exists(), f"Missing golden dataset: {GOLDEN_PATH}"
    with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
        transcripts = [json.loads(line) for line in f if line.strip()]

    # Invariant 1: Size >= 40
    assert len(transcripts) >= 40, f"Expected >= 40 transcripts, got {len(transcripts)}"

    # Invariant 2: >= 40% Indic mix
    indic_count = sum(1 for t in transcripts if t["lang"] in ("hi", "hi-Latn", "mixed"))
    indic_pct = (indic_count / len(transcripts)) * 100
    assert indic_pct >= 40.0, f"Indic percentage {indic_pct:.1f}% below 40% requirement"

    # Invariant 3: All 10 phenomena covered >= 4 times
    required_tags = [
        "explicit_revision",
        "implicit_revision",
        "retraction",
        "tentative",
        "topic_return",
        "restatement",
        "negation_trap",
        "cross_lingual",
        "distractor",
        "injection",
    ]
    tag_counts: dict[str, int] = {}
    for t in transcripts:
        for tag in t["tags"]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    for tag in required_tags:
        assert tag_counts.get(tag, 0) >= 4, f"Tag '{tag}' count {tag_counts.get(tag, 0)} < 4"

    # Invariant 4: 30% test split
    test_count = sum(1 for t in transcripts if t["split"] == "test")
    test_pct = (test_count / len(transcripts)) * 100
    assert test_pct == 30.0, f"Test split {test_pct}% != 30%"


def test_system_s_satisfies_eval_gate() -> None:
    with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
        transcripts = [json.loads(line) for line in f if line.strip()]

    with open(THRESHOLDS_PATH, "r", encoding="utf-8") as f:
        thresholds = json.load(f)
    fia_threshold = thresholds.get("fia_threshold", 0.85)

    fias: list[float] = []
    for t in transcripts:
        output = run_system_s(t)
        fia, _, _, _, _, _ = evaluate_output(output, t["gold"], t["tags"])
        fias.append(fia)

    avg_fia = sum(fias) / len(fias)
    assert avg_fia >= fia_threshold, f"Average FIA {avg_fia} failed threshold {fia_threshold}"
