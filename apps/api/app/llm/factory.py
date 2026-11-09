"""
LLM provider factory — selects implementation based on LLM_PROVIDER setting.
"""
from __future__ import annotations

from app.core.config import Settings
from app.llm.base import LLMProvider
from app.llm.fake import FakeLLMProvider


def build_llm_provider(settings: Settings) -> LLMProvider:
    """
    Instantiate the correct LLMProvider based on settings.LLM_PROVIDER.
    Falls back to FakeLLMProvider in test environments.
    """
    provider = settings.LLM_PROVIDER.lower()

    if provider == "fake" or provider == "":
        return FakeLLMProvider()

    if provider == "groq":
        from app.llm.groq import GroqLLMProvider

        return GroqLLMProvider(
            api_key=settings.GROQ_API_KEY,
            model=settings.LLM_MODEL,
            timeout_s=settings.LLM_TIMEOUT_S,
        )

    if provider == "anthropic":
        from app.llm.anthropic import AnthropicLLMProvider

        return AnthropicLLMProvider(
            model=settings.LLM_MODEL,
            timeout_s=settings.LLM_TIMEOUT_S,
        )

    if provider == "openai":
        from app.llm.openai import OpenAILLMProvider

        return OpenAILLMProvider(
            model=settings.LLM_MODEL,
            timeout_s=settings.LLM_TIMEOUT_S,
        )

    if provider == "gemini":
        from app.llm.gemini import GeminiLLMProvider

        return GeminiLLMProvider(
            model=settings.LLM_MODEL,
            api_key=settings.GEMINI_API_KEY,
            timeout_s=settings.LLM_TIMEOUT_S,
        )

    raise ValueError(f"Unknown LLM_PROVIDER: {settings.LLM_PROVIDER!r}. Expected: fake, anthropic, openai, gemini")
