"""Inworld Router (OpenAI-compatible chat completions) client."""
from __future__ import annotations

import httpx

from .config import settings


class LLMError(Exception):
    pass


async def chat(
    messages: list[dict],
    max_tokens: int = 120,
    temperature: float = 0.7,
    timeout: float = 8.0,
    model: str | None = None,
) -> str:
    headers = {"Authorization": f"Basic {settings.inworld_standard_key}", "Content-Type": "application/json"}
    body = {
        "model": model or settings.llm_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(settings.inworld_router_url, headers=headers, json=body)
        if r.status_code != 200:
            raise LLMError(f"router status {r.status_code}")
        content = r.json()["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise LLMError("router returned no text")
        return content.strip()
    except LLMError:
        raise
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        raise LLMError(type(exc).__name__) from exc
