from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    SUPABASE_URL: str = "http://127.0.0.1:54321"
    SUPABASE_ANON_KEY: str = "anon-key-placeholder"
    SUPABASE_SERVICE_ROLE_KEY: str = "service-role-placeholder"
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_JWKS_URL: str = "http://127.0.0.1:54321/auth/v1/.well-known/jwks.json"
    DATABASE_URL: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

    # API
    API_ENV: str = "development"
    API_PORT: int = 8000
    API_CORS_ORIGINS: str = "http://localhost:3000"
    API_LOG_LEVEL: str = "INFO"
    RATE_LIMIT_ANALYZE_PER_MIN: int = 6
    RATE_LIMIT_COMPILE_PER_MIN: int = 6
    DAILY_LLM_BUDGET_TOKENS: int = 300000
    MAX_TRANSCRIPT_CHARS: int = 12000

    # LLM
    LLM_PROVIDER: str = "fake"  # fake | groq | anthropic | openai | gemini
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    LLM_TIMEOUT_S: float = 30.0
    GROQ_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # STT
    STT_PROVIDER: str = "fake"  # fake | gnani | none
    GNANI_API_KEY: str = ""
    GNANI_API_URL: str = "https://api.vachana.ai/stt/v3"
    GNANI_LANGUAGE_CODE: str = "mixed"  # en-IN | hi-IN | mixed
    STT_API_KEY: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.API_CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
