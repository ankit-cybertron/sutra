"""
Google Gemini adapter for LLMProvider protocol.
Uses gemini-1.5-flash as default. Leverages JSON response type for structured output.
"""
from __future__ import annotations

import json
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class GeminiLLMProvider:
    """
    Wraps Google Gemini GenerativeModel API.
    Requires GEMINI_API_KEY in environment (passed as api_key).
    One repair retry on invalid JSON.
    """

    def __init__(self, model: str = "gemini-1.5-flash", api_key: str = "", timeout_s: float = 30.0) -> None:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        self._genai = genai
        self.model = model
        self.timeout_s = timeout_s

    async def structured(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        temperature: float = 0.0,
        timeout_s: float | None = None,
    ) -> T:
        import asyncio

        effective_timeout = timeout_s if timeout_s is not None else self.timeout_s
        json_schema = schema.model_json_schema()
        schema_hint = json.dumps(json_schema, indent=2)
        combined_prompt = (
            f"{system}\n\n{user}\n\n"
            f"Respond ONLY with valid JSON matching this schema:\n```json\n{schema_hint}\n```"
        )

        raw = await asyncio.wait_for(
            asyncio.to_thread(self._call_sync, combined_prompt, temperature),
            timeout=effective_timeout,
        )
        try:
            return schema.model_validate_json(raw)
        except (ValueError, json.JSONDecodeError):
            repair_prompt = (
                f"The following JSON is invalid or does not match the required schema.\n"
                f"Fix it and return only valid JSON:\n{raw}\n\nSchema:\n{schema_hint}"
            )
            repaired = await asyncio.wait_for(
                asyncio.to_thread(self._call_sync, repair_prompt, 0.0),
                timeout=effective_timeout,
            )
            return schema.model_validate_json(repaired)

    def _call_sync(self, prompt: str, temperature: float) -> str:
        model = self._genai.GenerativeModel(
            model_name=self.model,
            generation_config=self._genai.GenerationConfig(
                temperature=temperature,
                response_mime_type="application/json",
            ),
        )
        response = model.generate_content(prompt)
        raw = (response.text or "").strip()
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        return raw
