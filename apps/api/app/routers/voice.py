"""Voice router: Text-to-Speech, REST Speech-to-Text, and Realtime STT WebSocket relay."""

from typing import Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    Query,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from apps.api.app.dependencies import get_device_id, tts_rate_limiter
from apps.api.app.errors import ApiProblemError
from apps.api.app.schemas import STTResponse, TTSRequest
from apps.api.app.services import get_voice_service

router = APIRouter(tags=["Voice"])


@router.post(
    "/api/tts",
    dependencies=[Depends(tts_rate_limiter)],
)
async def text_to_speech(
    payload: TTSRequest,
) -> Response:
    voice_service = get_voice_service()
    audio_bytes, media_type = await voice_service.synthesize_speech(
        text=payload.text,
        lang=payload.lang or "hi-IN",
        voice=payload.voice,
    )
    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.post(
    "/api/stt",
    response_model=STTResponse,
)
async def speech_to_text(
    audio_file: UploadFile = File(...),
    lang: Optional[str] = "indic-auto",
) -> STTResponse:
    if not audio_file.filename:
        raise ApiProblemError(
            status_code=400,
            code="INVALID_AUDIO",
            title="Missing Audio File",
            detail="An audio file must be provided.",
        )

    content = await audio_file.read()
    if len(content) == 0:
        raise ApiProblemError(
            status_code=400,
            code="EMPTY_AUDIO",
            title="Empty Audio File",
            detail="Uploaded audio file has zero bytes.",
        )

    voice_service = get_voice_service()
    result = await voice_service.transcribe_file(
        audio_bytes=content,
        filename=audio_file.filename,
        lang=lang or "indic-auto",
    )
    return STTResponse(
        transcript=result.get("transcript", ""),
        lang=result.get("lang", lang or "auto"),
    )


@router.websocket("/ws/stt")
async def websocket_stt_relay(
    websocket: WebSocket,
    lang: str = Query("indic-auto"),
    device_id: str = Query("anonymous-device"),
):
    await websocket.accept()
    voice_service = get_voice_service()
    try:
        await voice_service.handle_realtime_websocket(
            websocket=websocket,
            device_id=device_id,
            lang=lang,
        )
    except WebSocketDisconnect:
        pass
