"""
Unit tests for pipeline/ and schemas.
Covers: normalize, detect_language, resolve, score, render, Spec validators, Claim/Decision models.
"""

from __future__ import annotations

import pytest

from app.pipeline.normalize import Utterance, detect_language, normalize
from app.pipeline.render import render
from app.pipeline.resolve import resolve
from app.pipeline.score import score
from app.schemas.spec import (
    AcceptanceCriterion,
    Assumption,
    Claim,
    CoreLoopStep,
    DataModel,
    Decision,
    EdgeCase,
    Entity,
    FieldDef,
    Problem,
    Scope,
    Screen,
    ScreenStates,
    Span,
    Spec,
    UserStory,
)

# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


def make_claim(
    id: str,
    topic: str,
    value: str,
    start: int,
    end: int,
    stance: str = "assert",
    revises: str | None = None,
    lang: str = "en",
) -> Claim:
    return Claim(
        id=id,
        topic=topic,
        value=value,
        stance=stance,  # type: ignore[arg-type]
        revises=revises,
        span=Span(start=start, end=end),
        lang=lang,
    )


def make_minimal_spec(**overrides: object) -> Spec:
    """Build a valid minimal Spec; override fields by keyword."""
    base: dict[str, object] = {
        "title": "Test App",
        "tagline": "A test application.",
        "problem": Problem(
            statement="Users cannot do the thing they need to do.",
            narrow_user="A busy professional who needs X.",
            why_now="Market forces.",
        ),
        "core_loop": [
            CoreLoopStep(step=1, actor="User", action="clicks button", outcome="Action triggered"),
            CoreLoopStep(
                step=2, actor="System", action="processes request", outcome="Result shown"
            ),
            CoreLoopStep(step=3, actor="User", action="views result", outcome="Task complete"),
        ],
        "scope": Scope(
            must=["Core feature"],
            wont_now=["Nice-to-have"],
            cut_line="V1 ships core feature only.",
        ),
        "user_stories": [
            UserStory(
                id="US1",
                as_a="user",
                i_want="to use the app",
                so_that="I can get things done",
                priority="must",
            ),
        ],
        "data_model": DataModel(
            entities=[
                Entity(
                    name="Item",
                    fields=[
                        FieldDef(name="id", type="uuid", required=True),
                        FieldDef(name="name", type="text", required=True),
                    ],
                )
            ]
        ),
        "screens": [
            Screen(
                name="Main",
                purpose="Main screen.",
                states=ScreenStates(
                    empty="Nothing here.",
                    loading="Loading...",
                    error="Error occurred.",
                    success="Content loaded.",
                ),
            )
        ],
        "edge_cases": [
            EdgeCase(case="Empty state", handling="Show placeholder."),
            EdgeCase(case="Network failure", handling="Retry with backoff."),
            EdgeCase(case="Duplicate submit", handling="Idempotent — ignore second."),
        ],
        "acceptance_criteria": [
            AcceptanceCriterion(
                id="AC1",
                given="A user opens the app",
                when="They interact with main feature",
                then="They see the expected result",
                story="US1",
            )
        ],
        "first_prompt": "Build the core feature with clean architecture.\n\nDo not build payments, auth or admin in this phase.",
        "decisions": [
            Decision(topic="default.decision", final="initial value"),
        ],
        "assumptions": [],
        "open_questions": [],
    }
    base.update(overrides)
    return Spec(**base)  # type: ignore[arg-type]


# ===========================================================================
# normalize()
# ===========================================================================


class TestNormalize:
    def test_empty_string_returns_empty_list(self) -> None:
        assert normalize("") == []

    def test_whitespace_only_returns_empty_list(self) -> None:
        assert normalize("   \n\t  ") == []

    def test_single_sentence(self) -> None:
        result = normalize("Hello world.")
        assert len(result) == 1
        assert isinstance(result[0], Utterance)
        assert "Hello world" in result[0].text

    def test_multiple_sentences(self) -> None:
        result = normalize("First sentence. Second sentence. Third one!")
        assert len(result) >= 2

    def test_offset_accuracy(self) -> None:
        raw = "Hello world. Goodbye moon."
        result = normalize(raw)
        # Every utterance span must reference valid positions in raw
        for utt in result:
            assert utt.span.start >= 0
            assert utt.span.end <= len(raw)
            assert utt.span.start < utt.span.end

    def test_unicode_normalized_nfc(self) -> None:
        # Compose a string with combining characters
        raw = "caf\u0065\u0301 is nice."  # e + combining acute accent (NFD form)
        result = normalize(raw)
        assert len(result) >= 1
        # NFC: should be é (precomposed)
        assert "\u00e9" in result[0].text

    def test_exceeds_12000_chars_raises(self) -> None:
        with pytest.raises(ValueError, match="12,000"):
            normalize("x" * 12001)

    def test_exactly_12000_chars_ok(self) -> None:
        # 12000 chars with minimal sentence structure — should not raise
        result = normalize("a" * 11999 + ".")
        assert isinstance(result, list)

    def test_utterances_have_unique_ids(self) -> None:
        result = normalize("First. Second. Third.")
        ids = [u.id for u in result]
        assert len(ids) == len(set(ids))

    def test_ids_are_sequential(self) -> None:
        result = normalize("Alpha. Beta. Gamma.")
        assert result[0].id == "u1"
        assert result[1].id == "u2"


# ===========================================================================
# detect_language()
# ===========================================================================


class TestDetectLanguage:
    def test_english_only(self) -> None:
        assert detect_language("The user wants to sign in to the application.") == "en"

    def test_devanagari_only(self) -> None:
        assert detect_language("यह एक परीक्षण है।") == "hi"

    def test_devanagari_mixed_with_english(self) -> None:
        lang = detect_language("यह feature अच्छी है।")
        assert lang == "mixed"

    def test_hinglish_romanized(self) -> None:
        lang = detect_language("Nahi yaar aur kuch bhi karo.")
        assert lang in ("hi-Latn", "mixed")

    def test_mixed_english_hinglish(self) -> None:
        lang = detect_language("I think aur we should build this feature nahi.")
        assert lang in ("mixed", "hi-Latn")

    def test_empty_string_returns_en(self) -> None:
        # Fallback for empty: no Devanagari, no Hinglish
        assert detect_language("") == "en"

    def test_pure_numbers_returns_en(self) -> None:
        assert detect_language("1234 5678") == "en"


# ===========================================================================
# resolve()
# ===========================================================================


class TestResolve:
    def test_empty_claims_returns_empty(self) -> None:
        decisions, traces = resolve([])
        assert decisions == []
        assert traces == []

    def test_single_assert_becomes_decision(self) -> None:
        claims = [make_claim("c1", "auth.method", "magic link", 0, 10)]
        decisions, _traces = resolve(claims)
        assert len(decisions) == 1
        assert decisions[0].final == "magic link"
        assert decisions[0].topic == "auth.method"

    def test_revise_supersedes_assert(self) -> None:
        claims = [
            make_claim("c1", "auth.method", "password", 0, 20, stance="assert"),
            make_claim("c2", "auth.method", "magic link", 25, 50, stance="revise", revises="c1"),
        ]
        decisions, _traces = resolve(claims)
        assert len(decisions) == 1
        assert decisions[0].final == "magic link"
        assert "password" in decisions[0].superseded

    def test_retract_drops_topic(self) -> None:
        claims = [
            make_claim("c1", "analytics.scope", "full analytics", 0, 20, stance="assert"),
            make_claim("c2", "analytics.scope", "full analytics", 25, 50, stance="retract"),
        ]
        decisions, _traces = resolve(claims)
        # Retracted topic must NOT appear in decisions
        assert all(d.topic != "analytics.scope" for d in decisions)

    def test_tentative_does_not_replace_assert(self) -> None:
        claims = [
            make_claim("c1", "storage.type", "postgres", 0, 20, stance="assert"),
            make_claim("c2", "storage.type", "maybe redis", 25, 50, stance="tentative"),
        ]
        decisions, _traces = resolve(claims)
        # Assert still wins
        assert len(decisions) == 1
        assert decisions[0].final == "postgres"

    def test_multiple_topics_independent(self) -> None:
        claims = [
            make_claim("c1", "auth.method", "oauth", 0, 10),
            make_claim("c2", "storage.type", "postgres", 20, 40),
        ]
        decisions, _ = resolve(claims)
        topics = {d.topic for d in decisions}
        assert topics == {"auth.method", "storage.type"}

    def test_revision_trace_contains_all_steps(self) -> None:
        claims = [
            make_claim("c1", "topic", "v1", 0, 10),
            make_claim("c2", "topic", "v2", 15, 25, stance="revise", revises="c1"),
        ]
        _, traces = resolve(claims)
        assert len(traces) == 1
        assert len(traces[0].steps) == 2

    def test_final_value_in_original_claims(self) -> None:
        """Invariant 5: final value == value of some claim in that topic."""
        claims = [
            make_claim("c1", "topic", "value1", 0, 10),
            make_claim("c2", "topic", "value2", 20, 30, stance="revise"),
        ]
        decisions, _ = resolve(claims)
        all_values = {c.value for c in claims}
        for d in decisions:
            assert d.final in all_values

    def test_superseded_values_come_from_claims(self) -> None:
        """Invariant 6: superseded values must come from actual claims."""
        claims = [
            make_claim("c1", "topic", "original", 0, 10),
            make_claim("c2", "topic", "revised", 20, 30, stance="revise", revises="c1"),
        ]
        decisions, _ = resolve(claims)
        all_values = {c.value for c in claims}
        for d in decisions:
            for sv in d.superseded:
                assert sv in all_values

    def test_idempotent_resolve(self) -> None:
        """Invariant 1: resolve(resolve(claims)[0]) == resolve(claims)[0]."""
        claims = [
            make_claim("c1", "topic", "original", 0, 10),
            make_claim("c2", "topic", "revised", 20, 30, stance="revise", revises="c1"),
        ]
        decisions1, _ = resolve(claims)
        # Build new claims from decisions (simulate re-resolve)
        rederived = [make_claim(f"r{i}", d.topic, d.final, 0, 10) for i, d in enumerate(decisions1)]
        decisions2, _ = resolve(rederived)
        assert [d.final for d in decisions1] == [d.final for d in decisions2]


# ===========================================================================
# score()
# ===========================================================================


class TestScore:
    def test_perfect_spec_scores_high(self) -> None:
        spec = make_minimal_spec()
        result = score(spec, unanswered_questions_count=0)
        assert result.score >= 70  # minimal but valid spec

    def test_score_never_below_zero(self) -> None:
        # Maximal penalties: 4 high-risk open assumptions + 3 unanswered questions
        spec = make_minimal_spec(
            assumptions=[
                Assumption(
                    id=f"A{i}", statement=f"Risky assumption {i}", risk="high", status="open"
                )
                for i in range(5)
            ]
        )
        result = score(spec, unanswered_questions_count=5)
        assert result.score >= 0

    def test_score_never_above_100(self) -> None:
        spec = make_minimal_spec()
        result = score(spec)
        assert result.score <= 100

    def test_generic_narrow_user_penalized(self) -> None:
        """'everyone' is a generic term → narrow user earns 0."""
        spec = make_minimal_spec(
            problem=Problem(
                statement="Users cannot do the thing they need to do.",
                narrow_user="everyone",
                why_now="Market forces.",
            )
        )
        result = score(spec)
        nu_item = next(b for b in result.breakdown if b.component == "Narrow user")
        assert nu_item.earned == 0

    def test_specific_narrow_user_earns_full(self) -> None:
        spec = make_minimal_spec()
        result = score(spec)
        nu_item = next(b for b in result.breakdown if b.component == "Narrow user")
        assert nu_item.earned == 15

    def test_core_loop_less_than_3_steps_penalized(self) -> None:
        """score() recognizes a 1-step loop as incomplete — test via model_construct bypass."""
        base_spec = make_minimal_spec()
        # Bypass Pydantic validation to inject a short core_loop directly into score()
        short_loop = [CoreLoopStep(step=1, actor="User", action="acts", outcome="done")]
        patched = base_spec.model_copy(update={"core_loop": short_loop})
        result = score(patched)
        cl_item = next(b for b in result.breakdown if b.component == "Core loop")
        assert cl_item.earned < 15

    def test_core_loop_3_to_7_steps_full_score(self) -> None:
        spec = make_minimal_spec()  # has exactly 3 steps
        result = score(spec)
        cl_item = next(b for b in result.breakdown if b.component == "Core loop")
        assert cl_item.earned == 15

    def test_high_risk_assumption_penalty_capped_at_20(self) -> None:
        """5 high-risk open assumptions → penalty should cap at 20, not 25."""
        spec = make_minimal_spec(
            assumptions=[
                Assumption(id=f"A{i}", statement=f"Risky {i}", risk="high", status="open")
                for i in range(5)
            ]
        )
        result = score(spec, unanswered_questions_count=0)
        penalty_item = next(
            (b for b in result.breakdown if "high-risk" in b.component.lower()), None
        )
        assert penalty_item is not None
        assert penalty_item.earned == -20  # capped at -20

    def test_unanswered_questions_penalty_capped_at_9(self) -> None:
        """4 unanswered questions → penalty should cap at -9, not -12."""
        spec = make_minimal_spec()
        result = score(spec, unanswered_questions_count=4)
        penalty_item = next(
            (b for b in result.breakdown if "unanswered" in b.component.lower()), None
        )
        assert penalty_item is not None
        assert penalty_item.earned == -9  # capped at -9

    def test_missing_first_prompt_dnb_penalized(self) -> None:
        """score() assigns 3 pts when first_prompt lacks 'Do not build' — bypass via model_copy."""
        base_spec = make_minimal_spec()
        # model_copy skips the model_validator so we can inject a prompt without DNB
        patched = base_spec.model_copy(
            update={
                "first_prompt": "Build the entire system with no restrictions whatsoever please do everything."
            }
        )
        result = score(patched)
        fp_item = next(b for b in result.breakdown if b.component == "First prompt")
        assert fp_item.earned == 3

    def test_full_scope_scores_15(self) -> None:
        """Must + wont_now + cut_line = full scope score."""
        spec = make_minimal_spec()
        result = score(spec)
        sc_item = next(b for b in result.breakdown if b.component == "Scope and cut line")
        assert sc_item.earned == 15

    def test_missing_acceptance_criteria_coverage(self) -> None:
        """Must story without AC coverage earns 0 — bypass via model_copy."""
        base_spec = make_minimal_spec()
        # Inject an empty acceptance_criteria list; score() should give 0 for covered count
        patched = base_spec.model_copy(update={"acceptance_criteria": []})
        result = score(patched)
        ac_item = next(b for b in result.breakdown if b.component == "Acceptance criteria")
        assert ac_item.earned == 0

    def test_breakdown_items_are_consistent(self) -> None:
        """Every item's earned <= max (non-penalty items)."""
        spec = make_minimal_spec()
        result = score(spec)
        for item in result.breakdown:
            if item.max > 0:
                assert item.earned <= item.max
                assert item.earned >= 0

    def test_core_loop_over_7_steps_partial(self) -> None:
        """8 steps → earns 10 (not 15)."""
        base = make_minimal_spec()
        big_loop = [
            CoreLoopStep(step=i, actor="User", action="acts", outcome="done")
            for i in range(1, 9)  # 8 steps
        ]
        patched = base.model_copy(update={"core_loop": big_loop})
        result = score(patched)
        cl_item = next(b for b in result.breakdown if b.component == "Core loop")
        assert cl_item.earned == 10

    def test_core_loop_zero_steps_earns_zero(self) -> None:
        """0 steps → earns 0."""
        base = make_minimal_spec()
        patched = base.model_copy(update={"core_loop": []})
        result = score(patched)
        cl_item = next(b for b in result.breakdown if b.component == "Core loop")
        assert cl_item.earned == 0

    def test_missing_scope_cut_line_earns_zero(self) -> None:
        """Scope without cut_line earns 0 — test via model_copy bypass."""
        base = make_minimal_spec()
        # Build Scope via model_copy to avoid Pydantic min_length on cut_line
        base_scope = Scope(must=["Core"], wont_now=["Payment"], cut_line="V1 ships core only.")
        patched_scope = base_scope.model_copy(update={"cut_line": "   "})
        patched = base.model_copy(update={"scope": patched_scope})
        result = score(patched)
        sc_item = next(b for b in result.breakdown if b.component == "Scope and cut line")
        assert sc_item.earned == 0

    def test_data_model_one_field_entity_earns_partial(self) -> None:
        """Entity with 1 field (< 2) earns 4 (minimum)."""
        base = make_minimal_spec()
        single_field_dm = DataModel(
            entities=[
                Entity(
                    name="Simple",
                    fields=[FieldDef(name="id", type="uuid", required=True)],
                )
            ]
        )
        patched = base.model_copy(update={"data_model": single_field_dm})
        result = score(patched)
        dm_item = next(b for b in result.breakdown if b.component == "Data model")
        assert dm_item.earned == 4

    def test_data_model_unresolved_relations_earns_7(self) -> None:
        """Entity with 2+ fields but bad relation → earns 7."""
        base = make_minimal_spec()
        bad_dm = DataModel(
            entities=[
                Entity(
                    name="Order",
                    fields=[
                        FieldDef(name="id", type="uuid", required=True),
                        FieldDef(name="user_id", type="uuid", required=True),
                    ],
                    relations=["User 1:N NonExistentEntity"],
                )
            ]
        )
        patched = base.model_copy(update={"data_model": bad_dm})
        result = score(patched)
        dm_item = next(b for b in result.breakdown if b.component == "Data model")
        assert dm_item.earned == 7

    def test_edge_cases_fewer_than_3_earns_partial(self) -> None:
        """1 edge case earns int(1/3*10) = 3."""
        base = make_minimal_spec()
        patched = base.model_copy(
            update={"edge_cases": [EdgeCase(case="Single case", handling="Handle it.")]}
        )
        result = score(patched)
        ec_item = next(b for b in result.breakdown if b.component == "Edge cases")
        assert ec_item.earned == 3

    def test_screens_missing_state_earns_5(self) -> None:
        """Screen with empty-string states earns 5 (partial)."""
        base = make_minimal_spec()
        # ScreenStates requires min_length=1; bypass via model_copy
        incomplete_screen = Screen(
            name="S",
            purpose="p",
            states=ScreenStates(empty="e", loading="l", error="err", success="ok"),
        )
        # Patch states to have empty string via model_copy (bypasses validator)
        patched_states = incomplete_screen.states.model_copy(update={"empty": ""})
        patched_screen = incomplete_screen.model_copy(update={"states": patched_states})
        patched = base.model_copy(update={"screens": [patched_screen]})
        result = score(patched)
        ss_item = next(b for b in result.breakdown if b.component == "Screens and states")
        assert ss_item.earned == 5

    def test_first_prompt_too_long_earns_5(self) -> None:
        """first_prompt > 2500 chars with DNB → earns 5."""
        base = make_minimal_spec()
        long_prompt = "Do not build anything extra. " + "x " * 1300  # well over 2500 chars with dnb
        patched = base.model_copy(update={"first_prompt": long_prompt})
        result = score(patched)
        fp_item = next(b for b in result.breakdown if b.component == "First prompt")
        assert fp_item.earned == 5

    def test_all_must_stories_covered_earns_15(self) -> None:
        """When all must stories have AC, earns 15."""
        spec = make_minimal_spec()
        result = score(spec)
        ac_item = next(b for b in result.breakdown if b.component == "Acceptance criteria")
        assert ac_item.earned == 15

    def test_partial_must_coverage_earns_proportional(self) -> None:
        """50% coverage of must stories earns int(0.5 * 15) = 7."""
        base = make_minimal_spec(
            user_stories=[
                UserStory(id="US1", as_a="user", i_want="x", so_that="y", priority="must"),
                UserStory(id="US2", as_a="user", i_want="z", so_that="w", priority="must"),
            ],
            acceptance_criteria=[
                AcceptanceCriterion(id="AC1", given="g", when="w", then="t", story="US1"),
                AcceptanceCriterion(id="AC2", given="g2", when="w2", then="t2", story="US2"),
            ],
        )
        # Patch to only cover US1
        patched = base.model_copy(
            update={
                "acceptance_criteria": [
                    AcceptanceCriterion(id="AC1", given="g", when="w", then="t", story="US1"),
                ]
            }
        )
        result = score(patched)
        ac_item = next(b for b in result.breakdown if b.component == "Acceptance criteria")
        assert ac_item.earned == 7  # int(0.5 * 15)

    def test_no_must_stories_all_should_earns_15(self) -> None:
        """If there are no must stories, earns 15 (all covered vacuously)."""
        base = make_minimal_spec(
            user_stories=[
                UserStory(id="US1", as_a="user", i_want="x", so_that="y", priority="should"),
            ],
            acceptance_criteria=[
                AcceptanceCriterion(id="AC1", given="g", when="w", then="t", story="US1"),
            ],
        )
        result = score(base)
        ac_item = next(b for b in result.breakdown if b.component == "Acceptance criteria")
        assert ac_item.earned == 15


# ===========================================================================
# render()
# ===========================================================================

EXPECTED_HEADINGS = [
    "## 1. Problem and narrow user",
    "## 2. Core loop",
    "## 3. Scope and cut line",
    "## 4. User stories",
    "## 5. Data model",
    "## 6. Screens and states",
    "## 7. Edge cases",
    "## 8. Acceptance criteria",
    "## 9. First agent prompt",
]


class TestRender:
    def test_all_9_sections_present(self) -> None:
        spec = make_minimal_spec()
        md = render(spec)
        for heading in EXPECTED_HEADINGS:
            assert heading in md, f"Missing heading: {heading}"

    def test_headings_in_correct_order(self) -> None:
        spec = make_minimal_spec()
        md = render(spec)
        positions = [md.index(h) for h in EXPECTED_HEADINGS]
        assert positions == sorted(positions), "Headings are not in ascending order"

    def test_title_in_output(self) -> None:
        spec = make_minimal_spec()
        md = render(spec)
        assert "# Test App" in md

    def test_tagline_in_output(self) -> None:
        spec = make_minimal_spec()
        md = render(spec)
        assert "> A test application." in md

    def test_first_prompt_in_code_block(self) -> None:
        spec = make_minimal_spec()
        md = render(spec)
        assert "```text" in md
        assert "Do not build" in md

    def test_decisions_section_rendered(self) -> None:
        spec = make_minimal_spec(
            decisions=[Decision(topic="auth.method", final="magic link", superseded=["password"])]
        )
        md = render(spec)
        assert "auth.method" in md
        assert "magic link" in md

    def test_assumptions_section_rendered(self) -> None:
        spec = make_minimal_spec(
            assumptions=[
                Assumption(id="A1", statement="All users have email", risk="low", status="open")
            ]
        )
        md = render(spec)
        assert "All users have email" in md

    def test_snapshot_clinic_slots(self) -> None:
        """Snapshot: render DEFAULT_SPEC from fake.py — verify key markers."""
        from app.llm.fake import DEFAULT_SPEC

        md = render(DEFAULT_SPEC)
        assert "# Clinic Slots" in md
        assert "Request-and-approve" in md
        assert "## 1. Problem and narrow user" in md
        assert "## 5. Data model" in md
        assert "### Slot" in md
        assert "### Therapist" in md
        assert "Do not build" in md

    def test_render_returns_string(self) -> None:
        spec = make_minimal_spec()
        result = render(spec)
        assert isinstance(result, str)
        assert len(result) > 100

    def test_multiple_edge_cases_rendered(self) -> None:
        spec = make_minimal_spec()
        md = render(spec)
        assert "Empty state" in md
        assert "Network failure" in md
        assert "Duplicate submit" in md


# ===========================================================================
# Spec schema validators
# ===========================================================================


class TestSpecValidators:
    def test_duplicate_story_ids_raise(self) -> None:
        with pytest.raises(ValueError):
            make_minimal_spec(
                user_stories=[
                    UserStory(id="US1", as_a="user", i_want="x", so_that="y", priority="must"),
                    UserStory(id="US1", as_a="admin", i_want="z", so_that="w", priority="should"),
                ]
            )

    def test_ac_referencing_nonexistent_story_raises(self) -> None:
        with pytest.raises(ValueError):
            make_minimal_spec(
                acceptance_criteria=[
                    AcceptanceCriterion(
                        id="AC1",
                        given="setup",
                        when="action",
                        then="result",
                        story="NONEXISTENT",
                    )
                ]
            )

    def test_uncovered_must_story_raises(self) -> None:
        """A must-priority story with no AC must raise a validator error."""
        with pytest.raises(ValueError):
            make_minimal_spec(
                user_stories=[
                    UserStory(id="US1", as_a="user", i_want="x", so_that="y", priority="must"),
                    UserStory(id="US2", as_a="user", i_want="z", so_that="w", priority="must"),
                ],
                acceptance_criteria=[
                    AcceptanceCriterion(
                        id="AC1",
                        given="setup",
                        when="action",
                        then="result",
                        story="US1",
                    )
                ],
            )

    def test_missing_do_not_build_in_first_prompt_raises(self) -> None:
        """first_prompt without 'Do not build' must raise a validator error."""
        with pytest.raises(ValueError):
            make_minimal_spec(first_prompt="Build everything without restrictions.")

    def test_valid_spec_constructs_without_error(self) -> None:
        spec = make_minimal_spec()
        assert spec.title == "Test App"


# ===========================================================================
# Claim / Decision model validation
# ===========================================================================


class TestClaimModel:
    def test_valid_claim(self) -> None:
        c = make_claim("c1", "auth.method", "magic link", 0, 20)
        assert c.stance == "assert"

    def test_span_start_must_be_nonneg(self) -> None:
        with pytest.raises(ValueError):
            Claim(
                id="c1",
                topic="t",
                value="v",
                stance="assert",
                span=Span(start=-1, end=10),
                lang="en",
            )

    def test_span_end_must_be_nonneg(self) -> None:
        with pytest.raises(ValueError):
            Claim(
                id="c1",
                topic="t",
                value="v",
                stance="assert",
                span=Span(start=0, end=-5),
                lang="en",
            )

    def test_invalid_stance_raises(self) -> None:
        with pytest.raises(ValueError):
            Claim(
                id="c1",
                topic="t",
                value="v",
                stance="unknown",  # type: ignore[arg-type]
                span=Span(start=0, end=10),
                lang="en",
            )

    def test_extra_fields_forbidden(self) -> None:
        with pytest.raises(ValueError):
            Claim(
                id="c1",
                topic="t",
                value="v",
                stance="assert",
                span=Span(start=0, end=10),
                lang="en",
                extra_field="not allowed",  # type: ignore[call-arg]
            )


class TestDecisionModel:
    def test_valid_decision(self) -> None:
        d = Decision(topic="auth", final="magic link")
        assert d.superseded == []
        assert d.evidence == []

    def test_empty_topic_raises(self) -> None:
        with pytest.raises(ValueError):
            Decision(topic="", final="value")

    def test_empty_final_raises(self) -> None:
        with pytest.raises(ValueError):
            Decision(topic="auth", final="")


# ===========================================================================
# FakeLLMProvider
# ===========================================================================


class TestFakeLLMProvider:
    @pytest.mark.asyncio
    async def test_returns_claim_extraction_result(self) -> None:
        from app.llm.fake import ClaimExtractionResult, FakeLLMProvider

        llm = FakeLLMProvider()
        result = await llm.structured(
            system="sys",
            user="extract claims from: user wants magic link",
            schema=ClaimExtractionResult,
        )
        assert isinstance(result, ClaimExtractionResult)
        assert len(result.claims) >= 1

    @pytest.mark.asyncio
    async def test_returns_gap_analysis_result(self) -> None:
        from app.llm.fake import FakeLLMProvider, GapAnalysisResult

        llm = FakeLLMProvider()
        result = await llm.structured(
            system="sys",
            user="analyze gaps in this spec",
            schema=GapAnalysisResult,
        )
        assert isinstance(result, GapAnalysisResult)
        assert len(result.assumptions) >= 1

    @pytest.mark.asyncio
    async def test_returns_spec(self) -> None:
        from app.llm.fake import FakeLLMProvider

        llm = FakeLLMProvider()
        result = await llm.structured(
            system="sys",
            user="compile spec",
            schema=Spec,
        )
        assert isinstance(result, Spec)

    @pytest.mark.asyncio
    async def test_fixture_lookup_by_hash(self) -> None:
        from app.llm.fake import ClaimExtractionResult, FakeLLMProvider

        llm = FakeLLMProvider()
        # Register a custom fixture
        custom = ClaimExtractionResult(
            claims=[make_claim("custom1", "custom.topic", "custom value", 0, 20)]
        )
        user_text = "my specific prompt"
        h = llm.compute_hash(user_text)
        llm.register_fixture(h, custom)

        result = await llm.structured(
            system="sys",
            user=user_text,
            schema=ClaimExtractionResult,
        )
        assert result.claims[0].id == "custom1"

    @pytest.mark.asyncio
    async def test_call_history_recorded(self) -> None:
        from app.llm.fake import ClaimExtractionResult, FakeLLMProvider

        llm = FakeLLMProvider()
        await llm.structured(system="s", user="u", schema=ClaimExtractionResult)
        assert len(llm.call_history) == 1
        assert llm.call_history[0]["schema"] == "ClaimExtractionResult"

    @pytest.mark.asyncio
    async def test_unknown_schema_raises(self) -> None:
        from app.llm.fake import FakeLLMProvider

        class UnknownSchema(Claim):
            pass

        llm = FakeLLMProvider()
        with pytest.raises(ValueError, match="No fixture"):
            await llm.structured(system="s", user="u", schema=UnknownSchema)
