"""Test Voice API endpoints (TTS, STT, and Usage)."""

import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_tts_endpoint(client: AsyncClient):
    response = await client.post(
        "/api/tts",
        json={"text": "Namaste, ye ek test message hai.", "lang": "hi-IN"},
    )
    assert response.status_code == 200
    assert len(response.content) > 0
    assert "audio/" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_stt_endpoint(client: AsyncClient):
    fake_audio = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
    files = {"audio_file": ("test.wav", fake_audio, "audio/wav")}
    response = await client.post(
        "/api/stt",
        files=files,
        data={"lang": "indic-auto"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "transcript" in data
    assert len(data["transcript"]) > 0


@pytest.mark.asyncio
async def test_usage_endpoint(client: AsyncClient):
    response = await client.get("/api/usage")
    assert response.status_code == 200
    data = response.json()
    assert "groq" in data
    assert "gnani" in data
    assert "calls" in data["groq"]
    assert "stt_calls" in data["gnani"]
