"""
Gnani.ai Speech-to-Text adapter (Prisma STT).
Endpoint: https://api.vachana.ai/stt/v3
Specialized for Indic languages and Indian code-mixed Hinglish speech.
"""
from __future__ import annotations

import httpx

from app.core.logging import get_logger
from app.stt.base import TranscriptionResult

logger = get_logger("voxspec.stt.gnani")


class GnaniSTTProvider:
    def __init__(
        self,
        api_key: str,
        api_url: str = "https://api.vachana.ai/stt/v3",
        default_language_code: str = "mixed",
        timeout_s: float = 45.0,
    ) -> None:
        if not api_key:
            raise ValueError("GNANI_API_KEY must be provided for GnaniSTTProvider")
        self.api_key = api_key
        self.api_url = api_url
        self.default_language_code = default_language_code
        self.timeout_s = timeout_s

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        language_code: str | None = None,
    ) -> TranscriptionResult:
        lang = language_code or self.default_language_code
        headers = {
            "X-API-Key-ID": self.api_key,
            "token": self.api_key,
        }
        files = {
            "audio_file": (filename, audio_bytes, content_type),
        }
        data = {
            "language_code": lang,
            "model": "prisma-v3.0",
        }

        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            try:
                response = await client.post(
                    self.api_url,
                    headers=headers,
                    files=files,
                    data=data,
                )
            except httpx.TimeoutException as exc:
                raise TimeoutError(f"Gnani.ai STT request timed out after {self.timeout_s}s") from exc

            if response.status_code != 200:
                logger.error("Gnani.ai STT error %d: %s", response.status_code, response.text[:200])
                raise RuntimeError(
                    f"Gnani.ai STT returned HTTP {response.status_code}: {response.text[:200]}"
                )

            res_json = response.json()
            # Gnani.ai formats transcription in 'transcript' or 'data.transcript'
            transcript_text = ""
            if isinstance(res_json, dict):
                transcript_text = (
                    res_json.get("transcript")
                    or res_json.get("text")
                    or (res_json.get("data", {}).get("transcript") if isinstance(res_json.get("data"), dict) else "")
                    or ""
                )

            detected_lang = res_json.get("language_code", lang)
            confidence = res_json.get("confidence")

            return TranscriptionResult(
                text=transcript_text.strip(),
                detected_lang=str(detected_lang),
                confidence=float(confidence) if confidence is not None else None,
            )
