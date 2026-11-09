"""Audio transcription endpoint powered by Gnani.ai STT."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import Settings, get_settings
from app.stt import STTProvider, TranscriptionResult, build_stt_provider

router = APIRouter(prefix="/audio", tags=["Audio & STT"])

CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def get_stt(settings: AppSettings) -> STTProvider:
    return build_stt_provider(settings)


CurrentSTT = Annotated[STTProvider, Depends(get_stt)]


@router.post("/transcribe", response_model=TranscriptionResult)
async def transcribe_audio(
    user: CurrentUser,
    stt: CurrentSTT,
    file: Annotated[UploadFile, File(...)],
    language_code: Annotated[str, Form()] = "mixed",
) -> TranscriptionResult:
    """
    Transcribes audio bytes to text using Gnani.ai Indic & code-mixed STT
    (or Fake provider in offline/testing mode).
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a filename",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty",
        )

    # 10 MB audio file limit
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio file exceeds 10MB limit",
        )

    content_type = file.content_type or "audio/wav"
    result = await stt.transcribe(
        audio_bytes=content,
        filename=file.filename,
        content_type=content_type,
        language_code=language_code,
    )
    return result
