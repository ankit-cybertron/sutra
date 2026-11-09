from apps.api.app.services.session_service import SessionService
from apps.api.app.services.plan_service import PlanService
from apps.api.app.services.voice_service import VoiceService
from apps.api.app.services.usage_service import UsageService

_session_service: SessionService | None = None
_plan_service: PlanService | None = None
_voice_service: VoiceService | None = None
_usage_service: UsageService | None = None


def get_session_service() -> SessionService:
    global _session_service
    if _session_service is None:
        _session_service = SessionService()
    return _session_service


def get_plan_service() -> PlanService:
    global _plan_service
    if _plan_service is None:
        _plan_service = PlanService()
    return _plan_service


def get_voice_service() -> VoiceService:
    global _voice_service
    if _voice_service is None:
        _voice_service = VoiceService()
    return _voice_service


def get_usage_service() -> UsageService:
    global _usage_service
    if _usage_service is None:
        _usage_service = UsageService()
    return _usage_service
