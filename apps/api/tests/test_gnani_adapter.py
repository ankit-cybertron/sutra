"""Test Gnani AI Adapter (TTS caching and STT)."""

import pytest
from apps.api.app.adapters.gnani import GnaniAdapter


@pytest.mark.asyncio
async def test_gnani_tts_caching(temp_dir):
    cache_dir = temp_dir / "tts-cache"
    adapter = GnaniAdapter(mode="mock", cache_dir=cache_dir)

    text = "नमस्ते, आपका स्वागत है Sutra में।"
    audio1, media_type1 = await adapter.synthesize(text=text, lang="hi-IN")
    assert len(audio1) > 0
    assert adapter.tts_calls == 1
    assert adapter.tts_cache_hits == 0

    # Second call for identical text, voice, and language must hit disk cache
    audio2, media_type2 = await adapter.synthesize(text=text, lang="hi-IN")
    assert len(audio2) == len(audio1)
    assert adapter.tts_cache_hits == 1


@pytest.mark.asyncio
async def test_gnani_stt_file_mock(temp_dir):
    adapter = GnaniAdapter(mode="mock", cache_dir=temp_dir)
    res = await adapter.transcribe_audio_file(b"fake_pcm_data")
    assert "transcript" in res
    assert len(res["transcript"]) > 0
