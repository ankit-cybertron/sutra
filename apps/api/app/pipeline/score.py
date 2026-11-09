from app.schemas.spec import ReadinessScore, ScoreBreakdownItem, Spec

GENERIC_SEGMENT_TERMS = {"everyone", "users", "people", "anybody", "all users", "consumers"}


def score(spec: Spec, unanswered_questions_count: int = 0) -> ReadinessScore:
    """
    Computes a deterministic, explainable readiness score (0-100) and breakdown
    per docs/SPEC_SCHEMA.md section 2.
    """
    breakdown: list[ScoreBreakdownItem] = []
    total_score = 0

    # 1. Narrow user (15 points)
    narrow_user_clean = spec.problem.narrow_user.strip().lower()
    if not narrow_user_clean or narrow_user_clean in GENERIC_SEGMENT_TERMS:
        earned_nu = 0
        reason_nu = "Narrow user is too generic or empty."
    else:
        earned_nu = 15
        reason_nu = f"Specific narrow user defined: '{spec.problem.narrow_user}'."
    breakdown.append(
        ScoreBreakdownItem(component="Narrow user", earned=earned_nu, max=15, reason=reason_nu)
    )
    total_score += earned_nu

    # 2. Core loop (15 points)
    loop_len = len(spec.core_loop)
    valid_steps = all(
        s.actor.strip() and s.action.strip() and s.outcome.strip() for s in spec.core_loop
    )
    if 3 <= loop_len <= 7 and valid_steps:
        earned_cl = 15
        reason_cl = (
            f"Core loop contains {loop_len} structured steps with actor, action, and outcome."
        )
    elif loop_len < 3:
        earned_cl = max(0, loop_len * 4)
        reason_cl = f"Core loop has only {loop_len} steps (minimum is 3)."
    else:
        earned_cl = 10
        reason_cl = f"Core loop exceeds recommended 7 steps ({loop_len} steps)."
    breakdown.append(
        ScoreBreakdownItem(component="Core loop", earned=earned_cl, max=15, reason=reason_cl)
    )
    total_score += earned_cl

    # 3. Scope and cut line (15 points)
    has_cut = bool(spec.scope.cut_line.strip())
    has_must = len(spec.scope.must) >= 1
    has_wont = len(spec.scope.wont_now) >= 1
    if has_cut and has_must and has_wont:
        earned_sc = 15
        reason_sc = f"Explicit cut line, {len(spec.scope.must)} musts, and {len(spec.scope.wont_now)} explicit won't nows."
    else:
        earned_sc = 0
        missing = []
        if not has_cut:
            missing.append("cut line")
        if not has_must:
            missing.append("must scope")
        if not has_wont:
            missing.append("wont_now scope")
        reason_sc = f"Missing scope boundaries: {', '.join(missing)}."
    breakdown.append(
        ScoreBreakdownItem(
            component="Scope and cut line", earned=earned_sc, max=15, reason=reason_sc
        )
    )
    total_score += earned_sc

    # 4. Data model (10 points)
    entities = spec.data_model.entities
    entity_names = {e.name.lower() for e in entities}
    has_min_fields = any(len(e.fields) >= 2 for e in entities)
    relations_valid = True
    for e in entities:
        for rel in e.relations:
            # Check if referenced entities exist in rel string
            if " " in rel:
                parts = rel.split()
                if len(parts) >= 3 and parts[-1].lower() not in entity_names:
                    relations_valid = False

    if len(entities) >= 1 and has_min_fields and relations_valid:
        earned_dm = 10
        reason_dm = f"{len(entities)} entities with typed fields and valid relations."
    elif len(entities) >= 1 and has_min_fields:
        earned_dm = 7
        reason_dm = (
            f"{len(entities)} entities defined, but some relation references are unresolved."
        )
    else:
        earned_dm = 4
        reason_dm = "Data model lacks sufficient entity field detail."
    breakdown.append(
        ScoreBreakdownItem(component="Data model", earned=earned_dm, max=10, reason=reason_dm)
    )
    total_score += earned_dm

    # 5. Edge cases (10 points)
    ec_count = len(spec.edge_cases)
    if ec_count >= 3:
        earned_ec = 10
        reason_ec = f"{ec_count} edge cases with explicit handling."
    else:
        earned_ec = int((ec_count / 3.0) * 10)
        reason_ec = f"Only {ec_count} edge case(s) specified (expected at least 3)."
    breakdown.append(
        ScoreBreakdownItem(component="Edge cases", earned=earned_ec, max=10, reason=reason_ec)
    )
    total_score += earned_ec

    # 6. Acceptance criteria (15 points)
    must_stories = [s.id for s in spec.user_stories if s.priority == "must"]
    covered_stories = {ac.story for ac in spec.acceptance_criteria}
    if must_stories:
        covered_count = sum(1 for sid in must_stories if sid in covered_stories)
        coverage_ratio = covered_count / len(must_stories)
        earned_ac = int(15 * coverage_ratio)
        reason_ac = f"{covered_count}/{len(must_stories)} 'must' user stories covered by acceptance criteria."
    else:
        earned_ac = 15
        reason_ac = "All user stories have matching acceptance criteria."
    breakdown.append(
        ScoreBreakdownItem(
            component="Acceptance criteria", earned=earned_ac, max=15, reason=reason_ac
        )
    )
    total_score += earned_ac

    # 7. Screens and states (10 points)
    screen_count = len(spec.screens)
    all_states_defined = all(
        s.states.empty.strip()
        and s.states.loading.strip()
        and s.states.error.strip()
        and s.states.success.strip()
        for s in spec.screens
    )
    if screen_count >= 1 and all_states_defined:
        earned_ss = 10
        reason_ss = (
            f"All {screen_count} screen(s) define empty, loading, error, and success states."
        )
    else:
        earned_ss = 5
        reason_ss = (
            "Some screens are missing complete state descriptions (empty/loading/error/success)."
        )
    breakdown.append(
        ScoreBreakdownItem(
            component="Screens and states", earned=earned_ss, max=10, reason=reason_ss
        )
    )
    total_score += earned_ss

    # 8. First prompt (10 points)
    prompt_len = len(spec.first_prompt.strip())
    has_dnb = "do not build" in spec.first_prompt.lower()
    if 20 <= prompt_len <= 2500 and has_dnb:
        earned_fp = 10
        reason_fp = (
            f"Self-contained prompt ({prompt_len} chars) with explicit 'Do not build' section."
        )
    elif not has_dnb:
        earned_fp = 3
        reason_fp = "First prompt missing required 'Do not build' section."
    else:
        earned_fp = 5
        reason_fp = f"First prompt length ({prompt_len} chars) exceeds 2,500 chars limit."
    breakdown.append(
        ScoreBreakdownItem(component="First prompt", earned=earned_fp, max=10, reason=reason_fp)
    )
    total_score += earned_fp

    # 9. Penalties: Open high-risk assumptions (-5 each, max -20)
    high_risk_open = sum(1 for a in spec.assumptions if a.risk == "high" and a.status == "open")
    penalty_assumptions = min(20, high_risk_open * 5)
    if penalty_assumptions > 0:
        total_score -= penalty_assumptions
        breakdown.append(
            ScoreBreakdownItem(
                component="Penalty: high-risk open assumptions",
                earned=-penalty_assumptions,
                max=0,
                reason=f"{high_risk_open} open high-risk assumption(s) (-5 each, capped at -20).",
            )
        )

    # 10. Penalties: Unanswered questions (-3 each, max -9)
    penalty_questions = min(9, unanswered_questions_count * 3)
    if penalty_questions > 0:
        total_score -= penalty_questions
        breakdown.append(
            ScoreBreakdownItem(
                component="Penalty: unanswered questions",
                earned=-penalty_questions,
                max=0,
                reason=f"{unanswered_questions_count} unanswered question(s) at compile (-3 each, capped at -9).",
            )
        )

    final_score = max(0, min(100, total_score))
    return ReadinessScore(score=final_score, breakdown=breakdown)
