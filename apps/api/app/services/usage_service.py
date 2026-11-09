"""Usage tracking service for Gnani AI and Groq resources."""

from apps.api.app.adapters import get_gnani_adapter, get_groq_adapter
from apps.api.app.schemas import GnaniUsage, GroqUsage, UsageResponse


class UsageService:
    def __init__(self):
        self.groq = get_groq_adapter()
        self.gnani = get_gnani_adapter()

    def get_current_usage(self) -> UsageResponse:
        return UsageResponse(
            groq=GroqUsage(
                calls=self.groq.total_calls,
                estimated_tokens=self.groq.estimated_tokens,
            ),
            gnani=GnaniUsage(
                stt_calls=self.gnani.stt_calls,
                stt_seconds=round(self.gnani.stt_seconds, 2),
                tts_calls=self.gnani.tts_calls,
                tts_chars=self.gnani.tts_chars,
                tts_cache_hits=self.gnani.tts_cache_hits,
            ),
        )
