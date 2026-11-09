from collections import defaultdict

from app.schemas.spec import Claim, Decision, RevisionTrace, RevisionTraceStep


def resolve(claims: list[Claim]) -> tuple[list[Decision], list[RevisionTrace]]:
    """
    Deterministic Intent Convergence Resolver.
    Follows ARCHITECTURE.md section 4, docs/EVAL.md section 9, and docs/TESTING.md section 2.
    """
    if not claims:
        return [], []

    # 1. Group claims by topic (normalized)
    claims_by_topic: dict[str, list[Claim]] = defaultdict(list)
    for c in claims:
        topic_key = c.topic.strip().lower()
        claims_by_topic[topic_key].append(c)

    decisions: list[Decision] = []
    traces: list[RevisionTrace] = []

    # Sort topics alphabetically for deterministic output
    for topic_key in sorted(claims_by_topic.keys()):
        topic_claims = claims_by_topic[topic_key]
        # Invariant 2: Order-sensitive only by transcript position, never by claim id
        topic_claims.sort(key=lambda c: (c.span.start, c.span.end))

        # Store for claim id lookup within this topic
        claim_map: dict[str, Claim] = {c.id: c for c in topic_claims}

        open_claims: list[Claim] = []
        superseded_set: set[str] = set()  # claim IDs superseded
        trace_step_by_id: dict[str, RevisionTraceStep] = {}
        all_steps: list[RevisionTraceStep] = []

        for c in topic_claims:
            step = RevisionTraceStep(
                value=c.value,
                stance=c.stance,
                span=c.span,
                superseded=False,
            )
            trace_step_by_id[c.id] = step
            all_steps.append(step)

            if c.stance in ("revise", "retract"):
                # Find target claim to supersede
                target_claim: Claim | None = None
                if c.revises and c.revises in claim_map:
                    target_claim = claim_map[c.revises]
                elif open_claims:
                    target_claim = open_claims[-1]

                if target_claim is not None:
                    superseded_set.add(target_claim.id)
                    trace_step_by_id[target_claim.id].superseded = True
                    if target_claim in open_claims:
                        open_claims.remove(target_claim)

                if c.stance == "revise":
                    open_claims.append(c)
                elif c.stance == "retract":
                    # Invariant 4: Retraction drops the topic from open decisions
                    # Also mark the retract itself as not superseded
                    step.superseded = False

            elif c.stance == "assert":
                open_claims.append(c)

            elif c.stance == "tentative":
                # Invariant 3: tentative never supersedes an assert
                # Does not enter open_claims as a definitive decision
                pass

        # Build revision trace for this topic
        traces.append(RevisionTrace(topic=topic_claims[0].topic, steps=all_steps))

        # Determine final decision
        # Filter for active assert or revise
        active_decisive = [
            c
            for c in open_claims
            if c.id not in superseded_set and c.stance in ("assert", "revise")
        ]
        last_claim = topic_claims[-1]

        # If last stance was retract, topic is dropped from decisions
        if last_claim.stance == "retract" or not active_decisive:
            continue

        final_claim = active_decisive[-1]
        # Invariant 6: Superseded values
        superseded_vals = [
            claim_map[cid].value
            for cid in sorted(
                superseded_set, key=lambda cid: (claim_map[cid].span.start, claim_map[cid].span.end)
            )
            if claim_map[cid].value != final_claim.value
        ]

        evidence_spans = [
            c.span for c in topic_claims if c.stance in ("assert", "revise", "retract")
        ]

        # Invariant 5: Final value always equals the value of some claim in that topic
        decisions.append(
            Decision(
                topic=final_claim.topic,
                final=final_claim.value,
                superseded=superseded_vals,
                evidence=evidence_spans,
            )
        )

    return decisions, traces
