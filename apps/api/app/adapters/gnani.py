"""Gnani AI Adapter: Prisma STT (Realtime WebSocket + REST) & Timbre TTS with disk caching."""

import asyncio
import hashlib
import json
import logging
import os
import struct
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, Optional, Tuple, Union
import httpx
import websockets

from apps.api.app.config import settings
from apps.api.app.errors import ApiProblemError

logger = logging.getLogger("sutra.adapters.gnani")


class GnaniAdapter:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        cache_dir: Optional[Path] = None,
        mode: Optional[str] = None,
    ):
        self.api_key = api_key or settings.gnani_api_key
        self.base_url = (base_url or settings.gnani_base_url).rstrip("/")
        self.cache_dir = Path(cache_dir or settings.tts_cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.mode = (mode or settings.gnani_mode).lower()

        # Usage tracking counters
        self.stt_calls = 0
        self.stt_seconds = 0.0
        self.tts_calls = 0
        self.tts_chars = 0
        self.tts_cache_hits = 0

    @property
    def is_mock(self) -> bool:
        return self.mode == "mock" or not self.api_key or self.api_key.startswith("your_gnani")

    # --- TTS (Text to Speech) with SHA-256 Caching ---

    def _get_cache_path(self, text: str, voice: str, lang: str) -> Path:
        key = f"{text.strip()}:{voice}:{lang}".encode("utf-8")
        digest = hashlib.sha256(key).hexdigest()
        return self.cache_dir / f"{digest}.mp3"

    async def synthesize(
        self,
        text: str,
        lang: str = "hi-IN",
        voice: Optional[str] = None,
    ) -> Tuple[bytes, str]:
        """Synthesizes speech from text using Timbre v2.5. Returns (audio_bytes, media_type)."""
        selected_voice = voice or (
            settings.gnani_tts_voice_hi if "hi" in lang.lower() else settings.gnani_tts_voice_en
        )
        cache_file = self._get_cache_path(text, selected_voice, lang)

        # 1. Check disk cache
        if cache_file.exists():
            self.tts_cache_hits += 1
            try:
                audio_bytes = cache_file.read_bytes()
                return audio_bytes, "audio/mpeg"
            except Exception as e:
                logger.warning(f"Error reading TTS cache file: {e}")

        # 2. Check mock mode
        if self.is_mock:
            self.tts_calls += 1
            self.tts_chars += len(text)
            mock_audio = self._generate_mock_wav()
            # Cache the mock audio too
            try:
                cache_file.write_bytes(mock_audio)
            except Exception:
                pass
            return mock_audio, "audio/wav"

        # 3. Call Gnani Timbre REST endpoint
        url = f"{self.base_url}/api/v1/tts/inference"
        headers = {
            "X-API-Key-ID": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text[:300],  # Prompt credit discipline: cap lines at ~200-300 chars
            "voice": selected_voice,
            "model": "timbre-v2.5",
            "language": lang,
            "speed": 1.0,
            "audio_config": {
                "container": "mp3",
                "sample_rate": 24000,
                "encoding": "linear_pcm",
            },
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
            except Exception as exc:
                logger.warning(f"Gnani TTS request failed ({exc}). Falling back to mock audio.")
                mock_audio = self._generate_mock_wav()
                try:
                    cache_file.write_bytes(mock_audio)
                except Exception:
                    pass
                return mock_audio, "audio/wav"

            if response.status_code != 200:
                logger.warning(f"Gnani TTS returned {response.status_code}. Falling back to mock audio.")
                mock_audio = self._generate_mock_wav()
                try:
                    cache_file.write_bytes(mock_audio)
                except Exception:
                    pass
                return mock_audio, "audio/wav"

            audio_data = response.content
            self.tts_calls += 1
            self.tts_chars += len(text)

            # Save to disk cache
            try:
                cache_file.write_bytes(audio_data)
            except Exception as e:
                logger.warning(f"Failed to write TTS cache file: {e}")

            return audio_data, "audio/mpeg"

    # --- STT (Speech to Text) REST Fallback ---

    async def transcribe_audio_file(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        lang: str = "indic-auto",
    ) -> Dict[str, str]:
        """REST transcription fallback (<= 30s audio)."""
        duration_est = len(audio_bytes) / 32000.0  # 16kHz 16-bit mono = 32000 bytes/sec
        self.stt_calls += 1
        self.stt_seconds += min(duration_est, 30.0)

        if self.is_mock:
            return {
                "transcript": "Mujhe ek voice-first idea planner app banana hai jo Hinglish mein kaam kare.",
                "lang": "hinglish",
            }

        url = f"{self.base_url}/stt/v3"
        headers = {
            "X-API-Key-ID": self.api_key,
        }
        files = {
            "audio_file": (filename, audio_bytes, "audio/wav"),
        }
        data = {
            "model": "prisma-v3.0",
            "language_code": lang or settings.gnani_stt_lang,
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                response = await client.post(url, headers=headers, files=files, data=data)
            except Exception as exc:
                logger.error(f"Gnani STT REST request error: {exc}")
                raise ApiProblemError(
                    status_code=502,
                    code="GNANI_STT_NETWORK_ERROR",
                    title="STT Service Unavailable",
                    detail=f"Failed to reach Gnani STT service: {str(exc)}",
                )

            if response.status_code != 200:
                logger.error(f"Gnani STT error {response.status_code}: {response.text}")
                raise ApiProblemError(
                    status_code=502,
                    code="GNANI_STT_ERROR",
                    title="STT Transcription Error",
                    detail=f"Gnani STT returned HTTP {response.status_code}",
                )

            res_json = response.json()
            return {
                "transcript": res_json.get("transcript", ""),
                "lang": res_json.get("detected_language_code", lang),
            }

    # --- STT Realtime Streaming Connection ---

    async def open_stt_stream(
        self, lang: str = "indic-auto"
    ) -> Optional[Any]:
        """Establishes upstream WebSocket connection to Gnani Prisma v3."""
        if self.is_mock:
            return None

        ws_url = "wss://api.vachana.ai/stt/v3/stream"
        headers = {
            "x-api-key-id": self.api_key,
            "model": "prisma-v3.0",
            "language_code": lang or settings.gnani_stt_lang,
            "x-sample-rate": "16000",
        }

        try:
            ws = await websockets.connect(
                ws_url,
                additional_headers=headers,
                ping_interval=20,
                ping_timeout=10,
            )
            self.stt_calls += 1
            return ws
        except Exception as e:
            logger.error(f"Failed to open Gnani STT stream: {e}")
            return None

    def _generate_mock_wav(self) -> bytes:
        """Generates a small valid WAV file (0.5s of 440Hz sine wave tone)."""
        sample_rate = 16000
        num_samples = 8000
        header = bytearray()
        # RIFF chunk descriptor
        header.extend(b"RIFF")
        total_size = 36 + num_samples * 2
        header.extend(struct.pack("<I", total_size))
        header.extend(b"WAVE")
        # fmt sub-chunk
        header.extend(b"fmt ")
        header.extend(struct.pack("<I", 16))  # Subchunk1Size (16 for PCM)
        header.extend(struct.pack("<H", 1))   # AudioFormat (1 for PCM)
        header.extend(struct.pack("<H", 1))   # NumChannels (1 mono)
        header.extend(struct.pack("<I", sample_rate))
        header.extend(struct.pack("<I", sample_rate * 2))  # ByteRate
        header.extend(struct.pack("<H", 2))   # BlockAlign
        header.extend(struct.pack("<H", 16))  # BitsPerSample
        # data sub-chunk
        header.extend(b"data")
        header.extend(struct.pack("<I", num_samples * 2))

        # Audio samples
        samples = bytearray()
        import math
        for i in range(num_samples):
            val = int(math.sin(2.0 * math.pi * 440.0 * (i / sample_rate)) * 10000.0)
            samples.extend(struct.pack("<h", val))

        return bytes(header + samples)
