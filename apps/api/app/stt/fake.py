"""Deterministic fake STT provider for CI, offline testing, and browser verification."""

from __future__ import annotations

import hashlib

from app.stt.base import TranscriptionResult


class FakeSTTProvider:
    def __init__(self, default_text: str | None = None) -> None:
        self.default_text = (
            default_text
            or "I want an appointment booking app for my clinic. Patients should pick a slot, then owner approves on WhatsApp."
        )
        self.recorded_calls: list[dict[str, object]] = []

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        language_code: str = "mixed",
    ) -> TranscriptionResult:
        audio_hash = hashlib.sha256(audio_bytes).hexdigest()[:8]
        self.recorded_calls.append(
            {
                "bytes_len": len(audio_bytes),
                "filename": filename,
                "hash": audio_hash,
                "language_code": language_code,
            }
        )
        return TranscriptionResult(
            text=self.default_text,
            detected_lang=language_code if language_code != "mixed" else "hi-Latn",
            duration_s=4.2,
            confidence=0.98,
        )
