"""
Anthropic Claude adapter for LLMProvider protocol.
Uses claude-3-5-haiku as default for cost efficiency.
"""
from __future__ import annotations

import json
from typing import TypeVar

from pydantic import BaseModel

from app.llm.base import LLMProvider  # noqa: F401 — re-exported for isinstance checks

T = TypeVar("T", bound=BaseModel)


class AnthropicLLMProvider:
    """
    Wraps Anthropic Messages API.
    Requires ANTHROPIC_API_KEY in environment.
    One repair retry on invalid JSON.
    """

    def __init__(self, model: str = "claude-3-5-haiku-20241022", timeout_s: float = 30.0) -> None:
        import anthropic

        self._client = anthropic.AsyncAnthropic()
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
        augmented_user = (
            f"{user}\n\nRespond ONLY with valid JSON matching this schema:\n```json\n{schema_hint}\n```"
        )

        raw = await self._call(system, augmented_user, temperature, effective_timeout)
        try:
            return schema.model_validate_json(raw)
        except (ValueError, json.JSONDecodeError):
            # One repair retry: ask the model to fix its own output
            repair_user = (
                f"The following JSON is invalid or does not match the required schema.\n"
                f"Fix it and return only valid JSON:\n{raw}\n\nSchema:\n{schema_hint}"
            )
            repaired = await self._call(system, repair_user, 0.0, effective_timeout)
            return schema.model_validate_json(repaired)

    async def _call(self, system: str, user: str, temperature: float, timeout_s: float) -> str:
        import httpx

        try:
            response = await self._client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=temperature,
                system=system,
                messages=[{"role": "user", "content": user}],
                timeout=timeout_s,
            )
        except httpx.TimeoutException as exc:
            raise TimeoutError(f"Anthropic request timed out after {timeout_s}s") from exc

        # Extract text from first content block
        text_blocks = [b.text for b in response.content if hasattr(b, "text")]
        if not text_blocks:
            raise ValueError("Anthropic returned no text content")
        raw = text_blocks[0].strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        return str(raw)
