"""
OpenAI adapter for LLMProvider protocol.
Uses gpt-4o-mini as default. Leverages JSON mode for structured output.
"""

from __future__ import annotations

import json
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class OpenAILLMProvider:
    """
    Wraps OpenAI Chat Completions API with JSON response format.
    Requires OPENAI_API_KEY in environment.
    One repair retry on invalid JSON.
    """

    def __init__(self, model: str = "gpt-4o-mini", timeout_s: float = 30.0) -> None:
        import openai

        self._client = openai.AsyncOpenAI()
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
        effective_timeout = timeout_s if timeout_s is not None else self.timeout_s
        json_schema = schema.model_json_schema()
        schema_hint = json.dumps(json_schema, indent=2)
        augmented_user = f"{user}\n\nRespond ONLY with valid JSON matching this schema:\n```json\n{schema_hint}\n```"

        raw = await self._call(system, augmented_user, temperature, effective_timeout)
        try:
            return schema.model_validate_json(raw)
        except (ValueError, json.JSONDecodeError):
            repair_user = (
                f"The following JSON is invalid or does not match the required schema.\n"
                f"Fix it and return only valid JSON:\n{raw}\n\nSchema:\n{schema_hint}"
            )
            repaired = await self._call(system, repair_user, 0.0, effective_timeout)
            return schema.model_validate_json(repaired)

    async def _call(self, system: str, user: str, temperature: float, timeout_s: float) -> str:
        import httpx

        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                timeout=timeout_s,
            )
        except httpx.TimeoutException as exc:
            raise TimeoutError(f"OpenAI request timed out after {timeout_s}s") from exc

        raw = (response.choices[0].message.content or "").strip()
        return raw
