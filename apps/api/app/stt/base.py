"""Speech-to-Text (STT) Provider Protocol."""
from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel


class TranscriptionResult(BaseModel):
    text: str
    detected_lang: str = "en"
    duration_s: float | None = None
    confidence: float | None = None


class STTProvider(Protocol):
    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        language_code: str = "mixed",
    ) -> TranscriptionResult:
        """Transcribe audio bytes to text."""
        ...
