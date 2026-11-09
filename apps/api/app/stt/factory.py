"""STT provider factory."""

from __future__ import annotations

from app.core.config import Settings
from app.stt.base import STTProvider
from app.stt.fake import FakeSTTProvider


def build_stt_provider(settings: Settings) -> STTProvider:
    provider = settings.STT_PROVIDER.lower()

    if provider == "fake" or provider == "none" or provider == "":
        return FakeSTTProvider()

    if provider == "gnani":
        from app.stt.gnani import GnaniSTTProvider

        return GnaniSTTProvider(
            api_key=settings.GNANI_API_KEY,
            api_url=settings.GNANI_API_URL,
            default_language_code=settings.GNANI_LANGUAGE_CODE,
        )

    raise ValueError(
        f"Unknown STT_PROVIDER: {settings.STT_PROVIDER!r}. Expected: fake, gnani, none"
    )
