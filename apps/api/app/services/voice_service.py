"""Voice service handling TTS synthesis and Realtime/REST STT streaming."""

import asyncio
import json
import logging
import time
from typing import Dict, Optional, Set, Tuple
from fastapi import WebSocket, WebSocketDisconnect

from apps.api.app.adapters import get_gnani_adapter
from apps.api.app.config import settings

logger = logging.getLogger("sutra.services.voice")


class VoiceService:
    def __init__(self):
        # Track active device WebSocket sessions for concurrency limit (1 per device)
        self.active_devices: Set[str] = set()
        self._lock = asyncio.Lock()

    @property
    def gnani(self):
        return get_gnani_adapter()

    async def synthesize_speech(
        self,
        text: str,
        lang: str = "hi-IN",
        voice: Optional[str] = None,
    ) -> Tuple[bytes, str]:
        return await self.gnani.synthesize(text=text, lang=lang, voice=voice)

    async def transcribe_file(
        self,
        audio_bytes: bytes,
        filename: str = "recording.wav",
        lang: str = "indic-auto",
    ) -> Dict[str, str]:
        return await self.gnani.transcribe_audio_file(
            audio_bytes=audio_bytes, filename=filename, lang=lang
        )

    async def handle_realtime_websocket(
        self,
        websocket: WebSocket,
        device_id: str,
        lang: str = "indic-auto",
    ) -> None:
        # Enforce concurrency limit: 1 active stream per device
        async with self._lock:
            if device_id in self.active_devices:
                await websocket.close(
                    code=1008, reason="Another voice stream is already active for this device."
                )
                return
            self.active_devices.add(device_id)

        turn_start_time = time.time()
        max_duration = settings.ws_max_turn_duration_s
        upstream_ws = None
        upstream_task = None

        try:
            # Attempt to connect to Gnani STT stream
            upstream_ws = await self.gnani.open_stt_stream(lang=lang)

            if upstream_ws:
                # Upstream connected: relay messages from Gnani back to client
                async def forward_upstream_to_client():
                    try:
                        async for msg in upstream_ws:
                            if isinstance(msg, str):
                                try:
                                    parsed = json.loads(msg)
                                    text = parsed.get("transcript", parsed.get("text", ""))
                                    seg_id = parsed.get("segment_id", 0)
                                    detected_lang = parsed.get("detected_language_code", lang)
                                    await websocket.send_json(
                                        {
                                            "type": "transcript",
                                            "text": text,
                                            "segment_id": seg_id,
                                            "lang": detected_lang,
                                        }
                                    )
                                except json.JSONDecodeError:
                                    pass
                    except Exception as e:
                        logger.warning(f"Error reading from upstream Gnani socket: {e}")

                upstream_task = asyncio.create_task(forward_upstream_to_client())

            # Loop reading from client
            total_bytes = 0
            while True:
                # Check turn duration limit
                if time.time() - turn_start_time > max_duration:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": f"Turn exceeded maximum duration of {max_duration} seconds.",
                        }
                    )
                    break

                try:
                    # Idle timeout of 15 seconds
                    message = await asyncio.wait_for(websocket.receive(), timeout=15.0)
                except asyncio.TimeoutError:
                    await websocket.send_json(
                        {"type": "error", "message": "Voice stream timed out due to inactivity."}
                    )
                    break

                # Handle binary audio frame
                if "bytes" in message and message["bytes"]:
                    data = message["bytes"]
                    total_bytes += len(data)
                    if upstream_ws:
                        try:
                            await upstream_ws.send(data)
                        except Exception as e:
                            logger.error(f"Failed sending audio frame to upstream: {e}")
                    else:
                        # Mock realtime transcription simulation
                        if total_bytes >= 32000 and total_bytes % 32000 < len(data):
                            # Emit simulated intermediate segment every ~1 sec of audio
                            await websocket.send_json(
                                {
                                    "type": "transcript",
                                    "text": "Mujhe ek app chahiye jo ideas ko",
                                    "segment_id": 1,
                                    "lang": "hinglish",
                                }
                            )

                # Handle text control frame (e.g. {"type": "commit"})
                elif "text" in message and message["text"]:
                    try:
                        cmd = json.loads(message["text"])
                        if cmd.get("type") == "commit":
                            if upstream_ws:
                                await upstream_ws.send(json.dumps({"type": "commit"}))
                            else:
                                # Mock final transcript on commit
                                await websocket.send_json(
                                    {
                                        "type": "transcript",
                                        "text": "Mujhe ek voice-first idea planner app banana hai jo Hinglish mein kaam kare.",
                                        "segment_id": 2,
                                        "lang": "hinglish",
                                    }
                                )
                            break
                    except json.JSONDecodeError:
                        pass

        except WebSocketDisconnect:
            logger.info(f"Client disconnected WS voice session for device {device_id}")
        except Exception as exc:
            logger.error(f"Error in realtime STT WebSocket handler: {exc}")
            try:
                await websocket.send_json(
                    {"type": "error", "message": "Internal error in voice streaming relay."}
                )
            except Exception:
                pass
        finally:
            if upstream_task:
                upstream_task.cancel()
            if upstream_ws:
                try:
                    await upstream_ws.close()
                except Exception:
                    pass
            async with self._lock:
                self.active_devices.discard(device_id)
