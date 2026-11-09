"""Live smoke test for Groq and Gnani AI connectivity."""

import asyncio
import os
import time
from pathlib import Path

from apps.api.app.adapters.gnani import GnaniAdapter
from apps.api.app.adapters.groq import GroqAdapter
from apps.api.app.config import settings


async def run_live_smoke():
    print("=== SUTRA LIVE SMOKE TEST ===")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%SZ', time.gmtime())}")
    print(f"Groq Model: {settings.groq_model}")
    print(f"Gnani Base URL: {settings.gnani_base_url}")
    print(f"Gnani STT Lang: {settings.gnani_stt_lang}")

    results = []

    # 1. Test Groq Clarify
    print("\n--- 1. Testing Groq Clarify ---")
    groq = GroqAdapter()
    idea = "Mujhe ek college students ke liye Hinglish voice note app banana hai"
    start_t = time.time()
    try:
        res = await groq.clarify(idea=idea, lang="hinglish")
        duration = round(time.time() - start_t, 2)
        print(f"[OK] Clarify completed in {duration}s")
        print(f"Detected Lang: {res.detected_language}")
        print(f"Summary: {res.idea_summary}")
        print(f"Questions Count: {len(res.questions)}")
        for i, q in enumerate(res.questions, 1):
            print(f"  Q{i}: {q.display_text}")
        results.append({"service": "Groq", "op": "clarify", "status": "SUCCESS", "duration_s": duration})
    except Exception as e:
        print(f"[FAIL] Groq clarify failed: {e}")
        results.append({"service": "Groq", "op": "clarify", "status": "FAILED", "error": str(e)})

    # 2. Test Gnani TTS
    print("\n--- 2. Testing Gnani TTS ---")
    gnani = GnaniAdapter(mode="live")
    sample_text = "Sutra mein aapka swagat hai. Apna idea boliye."
    start_t = time.time()
    try:
        audio_bytes, media_type = await gnani.synthesize(text=sample_text, lang="hi-IN")
        duration = round(time.time() - start_t, 2)
        print(f"[OK] TTS completed in {duration}s")
        print(f"Audio bytes received: {len(audio_bytes)} ({media_type})")
        results.append({"service": "Gnani", "op": "tts", "status": "SUCCESS", "duration_s": duration, "bytes": len(audio_bytes)})
    except Exception as e:
        print(f"[FAIL] Gnani TTS failed: {e}")
        results.append({"service": "Gnani", "op": "tts", "status": "FAILED", "error": str(e)})

    # Summary
    print("\n=== SMOKE TEST SUMMARY ===")
    all_passed = all(r.get("status") == "SUCCESS" for r in results)
    for r in results:
        print(f"• {r['service']} {r['op']}: {r['status']}")

    return results


if __name__ == "__main__":
    asyncio.run(run_live_smoke())
