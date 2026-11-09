"""
Groq API adapter for LLMProvider protocol.
Uses llama-3.3-70b-versatile as default for ultra-fast, high quality structured output.
Leverages Groq's JSON mode (response_format={"type": "json_object"}).
"""

from __future__ import annotations

import json
from typing import TypeVar

import httpx
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqLLMProvider:
    """
    Wraps Groq's high-speed LPU inference API.
    Requires GROQ_API_KEY in environment or settings.
    One repair retry on invalid JSON or schema violation.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "llama-3.3-70b-versatile",
        timeout_s: float = 30.0,
    ) -> None:
        if not api_key:
            raise ValueError("GROQ_API_KEY must be provided for GroqLLMProvider")
        self.api_key = api_key
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
            # One repair retry
            repair_user = (
                f"The following JSON does not match the required schema.\n"
                f"Fix it and return only valid JSON matching the schema:\n{raw}\n\nSchema:\n{schema_hint}"
            )
            repaired = await self._call(system, repair_user, 0.0, effective_timeout)
            return schema.model_validate_json(repaired)

    async def _call(self, system: str, user: str, temperature: float, timeout_s: float) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }

        async with httpx.AsyncClient(timeout=timeout_s) as client:
            try:
                response = await client.post(GROQ_API_URL, headers=headers, json=payload)
            except httpx.TimeoutException as exc:
                raise TimeoutError(f"Groq API request timed out after {timeout_s}s") from exc

            if response.status_code != 200:
                raise RuntimeError(
                    f"Groq API returned HTTP {response.status_code}: {response.text[:300]}"
                )

            data = response.json()
            content = data["choices"][0]["message"]["content"] or ""
            raw = content.strip()
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            return raw
