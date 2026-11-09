from app.schemas.spec import Spec


def render(spec: Spec) -> str:
    """
    Renders a Spec object into authoritative Markdown per docs/SPEC_SCHEMA.md section 5.
    Headings order is strictly preserved.
    """
    lines: list[str] = []

    # Title & Tagline
    lines.append(f"# {spec.title}")
    lines.append("")
    lines.append(f"> {spec.tagline}")
    lines.append("")

    # 1. Problem and narrow user
    lines.append("## 1. Problem and narrow user")
    lines.append("")
    lines.append(f"**Statement:** {spec.problem.statement}")
    lines.append("")
    lines.append(f"**Narrow User:** {spec.problem.narrow_user}")
    if spec.problem.why_now:
        lines.append("")
        lines.append(f"**Why Now:** {spec.problem.why_now}")
    lines.append("")

    # 2. Core loop
    lines.append("## 2. Core loop")
    lines.append("")
    for step in sorted(spec.core_loop, key=lambda s: s.step):
        lines.append(f"{step.step}. **{step.actor}** {step.action} -> *{step.outcome}*")
    lines.append("")

    # 3. Scope and cut line
    lines.append("## 3. Scope and cut line")
    lines.append("")
    lines.append(f"**Cut Line:** {spec.scope.cut_line}")
    lines.append("")
    lines.append("### Must Have")
    for item in spec.scope.must:
        lines.append(f"- {item}")
    lines.append("")
    if spec.scope.should:
        lines.append("### Should Have")
        for item in spec.scope.should:
            lines.append(f"- {item}")
        lines.append("")
    lines.append("### Won't Have (Now)")
    for item in spec.scope.wont_now:
        lines.append(f"- {item}")
    lines.append("")

    # 4. User stories
    lines.append("## 4. User stories")
    lines.append("")
    for us in spec.user_stories:
        lines.append(
            f"- **[{us.id}]** ({us.priority.upper()}) As a {us.as_a}, I want to {us.i_want}, so that {us.so_that}."
        )
    lines.append("")

    # 5. Data model
    lines.append("## 5. Data model")
    lines.append("")
    for entity in spec.data_model.entities:
        lines.append(f"### {entity.name}")
        lines.append("| Field | Type | Required | Notes |")
        lines.append("|---|---|---|---|")
        for f in entity.fields:
            req_str = "Yes" if f.required else "No"
            lines.append(f"| {f.name} | `{f.type}` | {req_str} | {f.notes} |")
        if entity.relations:
            lines.append("")
            lines.append("**Relations:** " + ", ".join(f"`{r}`" for r in entity.relations))
        lines.append("")

    # 6. Screens and states
    lines.append("## 6. Screens and states")
    lines.append("")
    for screen in spec.screens:
        lines.append(f"### {screen.name}")
        lines.append(f"*{screen.purpose}*")
        lines.append("")
        lines.append(f"- **Empty:** {screen.states.empty}")
        lines.append(f"- **Loading:** {screen.states.loading}")
        lines.append(f"- **Error:** {screen.states.error}")
        lines.append(f"- **Success:** {screen.states.success}")
        lines.append("")

    # 7. Edge cases
    lines.append("## 7. Edge cases")
    lines.append("")
    for ec in spec.edge_cases:
        lines.append(f"- **{ec.case}:** {ec.handling}")
    lines.append("")

    # 8. Acceptance criteria
    lines.append("## 8. Acceptance criteria")
    lines.append("")
    for ac in spec.acceptance_criteria:
        lines.append(f"### [{ac.id}] (Story: {ac.story})")
        lines.append(f"- **Given:** {ac.given}")
        lines.append(f"- **When:** {ac.when}")
        lines.append(f"- **Then:** {ac.then}")
        lines.append("")

    # 9. First agent prompt
    lines.append("## 9. First agent prompt")
    lines.append("")
    lines.append("```text")
    lines.append(spec.first_prompt)
    lines.append("```")
    lines.append("")

    # Decisions and revisions
    lines.append("## Decisions and revisions")
    lines.append("")
    for dec in spec.decisions:
        lines.append(f"- **{dec.topic}:** {dec.final}")
        if dec.superseded:
            lines.append(f"  - *Superseded:* {', '.join(dec.superseded)}")
    lines.append("")

    # Assumptions
    lines.append("## Assumptions")
    lines.append("")
    if spec.assumptions:
        for asm in spec.assumptions:
            lines.append(
                f"- **[{asm.id}]** ({asm.risk.upper()} / {asm.status.upper()}): {asm.statement}"
            )
    else:
        lines.append("No active assumptions recorded.")
    lines.append("")

    # Open questions
    lines.append("## Open questions")
    lines.append("")
    if spec.open_questions:
        for q in spec.open_questions:
            lines.append(f"- {q}")
    else:
        lines.append("No open questions remaining.")
    lines.append("")

    return "\n".join(lines)
