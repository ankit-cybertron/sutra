"""Configuration management for Sutra backend."""

import os
from pathlib import Path
from typing import List
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load .env file from project root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT_DIR / ".env")


class BrandConfig(BaseModel):
    name: str = Field(default_factory=lambda: os.getenv("BRAND_NAME", "Sutra"))
    tagline: str = Field(
        default_factory=lambda: os.getenv("BRAND_TAGLINE", "Say the idea. Skip the rambling.")
    )
    description: str = "Voice-first idea-to-plan engine powered by Gnani AI and Groq."


class Settings(BaseModel):
    # Brand
    brand: BrandConfig = Field(default_factory=BrandConfig)

    # Server & Environment
    env: str = Field(default_factory=lambda: os.getenv("API_ENV", os.getenv("ENV", "development")))
    host: str = Field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = Field(default_factory=lambda: int(os.getenv("PORT", os.getenv("API_PORT", "8000"))))
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                os.getenv("API_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000"),
            ).split(",")
            if origin.strip()
        ]
    )

    # Groq LLM
    groq_api_key: str = Field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))
    groq_model: str = Field(
        default_factory=lambda: os.getenv("GROQ_MODEL", os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"))
    )
    groq_fallback_model: str = Field(
        default_factory=lambda: os.getenv("GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant")
    )
    groq_timeout_s: float = Field(
        default_factory=lambda: float(os.getenv("GROQ_TIMEOUT_S", os.getenv("LLM_TIMEOUT_S", "25.0")))
    )

    # Gnani AI (Voice)
    gnani_api_key: str = Field(default_factory=lambda: os.getenv("GNANI_API_KEY", ""))
    gnani_base_url: str = Field(
        default_factory=lambda: os.getenv("GNANI_BASE_URL", "https://api.vachana.ai").rstrip("/")
    )
    gnani_stt_lang: str = Field(
        default_factory=lambda: os.getenv("GNANI_STT_LANG", os.getenv("GNANI_LANGUAGE_CODE", "indic-auto"))
    )
    gnani_tts_voice_hi: str = Field(
        default_factory=lambda: os.getenv("GNANI_TTS_VOICE_HI", "Nalini")
    )
    gnani_tts_voice_en: str = Field(
        default_factory=lambda: os.getenv("GNANI_TTS_VOICE_EN", "Nalini")
    )
    gnani_mode: str = Field(
        default_factory=lambda: os.getenv("GNANI_MODE", "live").lower()
    )

    # Data Storage Paths
    data_dir: Path = Field(
        default_factory=lambda: ROOT_DIR / os.getenv("DATA_DIR", os.getenv("JSON_DB_PATH", "data"))
    )
    tts_cache_dir: Path = Field(
        default_factory=lambda: ROOT_DIR / os.getenv("TTS_CACHE_DIR", "data/tts-cache")
    )

    # Limits & Constraints
    max_idea_chars: int = Field(
        default_factory=lambda: int(os.getenv("MAX_IDEA_CHARS", os.getenv("MAX_TRANSCRIPT_CHARS", "1500")))
    )
    ws_max_turn_duration_s: float = 45.0
    rate_limit_per_minute: int = Field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
    )


settings = Settings()
