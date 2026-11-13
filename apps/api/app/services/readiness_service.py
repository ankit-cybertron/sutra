import re
from typing import Tuple, List
from apps.api.app.schemas import Plan


def calculate_plan_readiness(p: Plan) -> int:
    """
    Calculates a genuine dynamic readiness score (0-100) based on actual
    project completeness across 10 evaluation dimensions.
    """
    all_text = " ".join([
        p.title or "",
        p.one_liner or "",
        p.problem or "",
        p.target_user or "",
        p.tech_notes or "",
        p.first_prompt or "",
        " ".join(p.core_loop or []),
        " ".join([f"{m.name} {m.why} {' '.join(m.acceptance)}" for m in p.must_have]),
        " ".join(p.later or []),
        " ".join(p.out_of_scope or []),
        " ".join([f"{b.title} {b.detail}" for b in p.build_order]),
        " ".join(p.risks or []),
        " ".join(p.assumptions or []),
        " ".join(p.open_questions or []),
    ]).lower()

    score = 0

    # 1. Requirements Completeness (10 pts)
    if p.target_user and len(p.target_user) > 15:
        score += 3
    if p.problem and len(p.problem) > 25:
        score += 3
    if p.core_loop and len(p.core_loop) >= 3:
        score += 4
    elif p.core_loop and len(p.core_loop) > 0:
        score += 2
    if p.open_questions and len(p.open_questions) > 3:
        score = max(0, score - 2)

    # 2. Feature Definition (12 pts)
    if p.must_have and len(p.must_have) >= 3:
        score += 5
    elif p.must_have and len(p.must_have) > 0:
        score += 3

    total_acceptance = sum(len(m.acceptance) for m in p.must_have) if p.must_have else 0
    avg_acceptance = total_acceptance / len(p.must_have) if p.must_have else 0
    if avg_acceptance >= 2.5:
        score += 4
    elif avg_acceptance >= 1.0:
        score += 2

    if p.later and p.out_of_scope:
        score += 3
    elif p.later or p.out_of_scope:
        score += 1

    # 3. Technical Architecture (10 pts)
    if p.tech_notes and len(p.tech_notes) > 60:
        score += 4
    has_client = bool(re.search(r"react|vue|svelte|next|web|spa|mobile|flutter|client|ios|android", all_text))
    has_api = bool(re.search(r"api|rest|fastapi|express|backend|graphql|router|gateway", all_text))
    has_worker = bool(re.search(r"queue|worker|celery|job|async|redis|cron|background", all_text))
    if has_client and has_api:
        score += 4
    elif has_client or has_api:
        score += 2
    if has_worker:
        score += 2

    # 4. Database & Storage Design (10 pts)
    has_db_tech = bool(re.search(r"postgres|postgresql|mysql|sqlite|mongodb|redis|prisma|sqlalchemy|dynamo|supabase", all_text))
    has_db_model = bool(re.search(r"schema|table|relation|foreign key|index|crud|persist|store|cache|entity|collection", all_text))
    if has_db_tech:
        score += 5
    if has_db_model:
        score += 5

    # 5. API & Integrations (10 pts)
    has_protocol = bool(re.search(r"rest|websocket|graphql|http|json|grpc|webhook", all_text))
    has_integration = bool(re.search(r"whatsapp|twilio|stripe|paypal|razorpay|oauth|smtp|mail|groq|gemini|openai|ai|third-party|meta|sdk", all_text))
    if has_protocol:
        score += 5
    if has_integration:
        score += 5

    # 6. Security Considerations & Authentication (10 pts)
    has_auth = bool(re.search(r"auth|jwt|oauth|session|token|login|otp|password|rbac|permission|bcrypt|credentials", all_text))
    has_sec = bool(re.search(r"rate limit|cors|encrypt|sanitize|validation|helmet|csrf|https|tls|hash", all_text))
    if has_auth:
        score += 5
    if has_sec:
        score += 5

    # 7. Technology Stack Specificity (10 pts)
    has_lang = bool(re.search(r"python|node|typescript|javascript|golang|rust|react|fastapi|express|next|django", all_text))
    has_tooling = bool(re.search(r"vite|docker|tailwind|pydantic|pytest|vitest|eslint|npm|pip|poetry", all_text))
    if has_lang:
        score += 5
    if has_tooling:
        score += 5

    # 8. Deployment Readiness (8 pts)
    has_deploy = bool(re.search(r"docker|dockerfile|kubernetes|k8s|container|vercel|aws|gcp|railway|render|fly\.io|nginx|cloudflare", all_text))
    has_config = bool(re.search(r"env|environment variable|ci\/cd|github actions|deploy|cluster|domain|ssl", all_text))
    if has_deploy:
        score += 4
    if has_config:
        score += 4

    # 9. Technical Risks (10 pts)
    if p.risks and len(p.risks) >= 3:
        score += 5
    elif p.risks and len(p.risks) > 0:
        score += 3

    if p.assumptions and len(p.assumptions) >= 2:
        score += 5
    elif p.assumptions and len(p.assumptions) > 0:
        score += 3

    # 10. Implementation Planning (10 pts)
    if p.build_order and len(p.build_order) >= 4:
        score += 5
    elif p.build_order and len(p.build_order) > 0:
        score += 3

    if p.first_prompt and len(p.first_prompt) > 80:
        score += 5
    elif p.first_prompt and len(p.first_prompt) > 20:
        score += 2

    return min(100, max(10, score))
