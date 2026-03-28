"""
LLMClient — central LLM abstraction for the entire backend.

Import pattern (everyone uses this singleton, never instantiate LLMClient directly):
    from app.core.llm_client import llm_client

Routing:
    "gemini-flash"  → gemini-1.5-flash-002 via Lava HTTP API   (fast; simulation ticks)
    "gemini-pro"    → gemini-1.5-pro-002 via Lava HTTP API     (smart; claims + report drafting)
    "k2-think"      → Kindo/K2-Think-V2 via LiteLLM            (reasoning; world-build + report planning)
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
import litellm
from litellm import acompletion  # pyright: ignore[reportUnknownVariableType]

litellm.suppress_debug_info = True

# ---------------------------------------------------------------------------
# Model name constants — use these everywhere; never hardcode the strings
# ---------------------------------------------------------------------------
MODEL_GEMINI_FLASH = "gemini-flash"
MODEL_GEMINI_PRO = "gemini-pro"
MODEL_K2_THINK = "k2-think"

# Internal mapping: model constant → actual model id used by the provider
_LAVA_MODEL_MAP = {
    MODEL_GEMINI_FLASH: "gemini-1.5-flash-002",
    MODEL_GEMINI_PRO: "gemini-1.5-pro-002",
}

_DEFAULT_LAVA_BASE_URL = "https://gateway.lavanet.xyz/api/v1"
_K2_MODEL_ID = "openai/MBZUAI-IFM/K2-Think-v2"
_K2_BASE_URL = "https://api.k2think.ai/v1"

_JSON_SUFFIX = (
    "\n\nRespond with valid JSON only. Do not include any text outside the JSON object."
)


class LLMClient:
    """
    Unified LLM client.  All callers import the module-level `llm_client` singleton.
    """

    def __init__(self) -> None:
        # Prefer the env names defined in TECH_STACK.md, but keep backward
        # compatibility with the original stub names.
        self._lava_api_key: str = os.getenv("LAVA_API_KEY") or os.getenv("LAVA_KEY", "")
        self._together_api_key: str = os.getenv("TOGETHER_API_KEY") or os.getenv(
            "TOGETHER_KEY", ""
        )
        self._k2_api_key: str = os.getenv("K2_API_KEY") or self._together_api_key
        self._lava_base_url: str = os.getenv(
            "LAVA_BASE_URL", _DEFAULT_LAVA_BASE_URL
        ).rstrip("/")
        self._lava_chat_completions_url: str = os.getenv(
            "LAVA_CHAT_COMPLETIONS_URL",
            f"{self._lava_base_url}/chat/completions",
        )
        self._lava_apollo_url: str = os.getenv(
            "LAVA_APOLLO_URL",
            f"{self._lava_base_url}/apollo/search",
        )
        timeout_seconds = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
        self._timeout: httpx.Timeout = httpx.Timeout(timeout_seconds)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def complete(
        self,
        prompt: str,
        system: str | None = None,
        model: str = MODEL_GEMINI_FLASH,
        response_format: str = "text",  # "text" or "json"
    ) -> str:
        """
        Call the LLM and return the response as a string.

        If response_format="json", the returned string is valid JSON
        (already parsed and re-serialised to strip markdown fences etc.).
        Caller is responsible for json.loads() if they need a dict.
        """
        prompt_to_send = (
            f"{prompt}{_JSON_SUFFIX}" if response_format == "json" else prompt
        )

        if model in _LAVA_MODEL_MAP:
            response_text = await self._complete_with_lava(
                prompt=prompt_to_send,
                system=system,
                model=model,
            )
        elif model == MODEL_K2_THINK:
            response_text = await self._complete_with_k2(
                prompt=prompt_to_send,
                system=system,
            )
        else:
            raise ValueError(f"Unsupported model '{model}'")

        if response_format == "json":
            return self._normalize_json_response(response_text)
        return response_text.strip()

    async def call_apollo(
        self,
        job_titles: list[str],
        keywords: list[str],
        limit: int = 12,
    ) -> list[dict[str, object]]:
        """
        Search Apollo.io via Lava and return a list of professional profile dicts.
        Each dict contains at minimum: title, company, industry.
        Returns empty list on provider failures so world-building can fall back.
        """
        if not self._lava_api_key:
            raise RuntimeError("Missing LAVA_API_KEY for Apollo access")

        payload = {
            "job_titles": job_titles,
            "keywords": keywords,
            "limit": limit,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    self._lava_apollo_url,
                    json=payload,
                    headers=self._lava_headers(),
                )
                response.raise_for_status()
        except httpx.HTTPError:
            return []

        data = response.json()
        raw_profiles = self._extract_apollo_results(data)
        normalized_profiles = [
            profile
            for profile in (
                self._normalize_apollo_profile(item) for item in raw_profiles
            )
            if profile is not None
        ]
        return normalized_profiles[:limit]

    async def _complete_with_lava(
        self,
        prompt: str,
        system: str | None,
        model: str,
    ) -> str:
        if not self._lava_api_key:
            raise RuntimeError("Missing LAVA_API_KEY for Lava-backed model call")

        messages = self._build_messages(prompt=prompt, system=system)
        payload = {
            "model": _LAVA_MODEL_MAP[model],
            "messages": messages,
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                self._lava_chat_completions_url,
                json=payload,
                headers=self._lava_headers(),
            )
            response.raise_for_status()

        data = response.json()
        return self._extract_message_content(data)

    async def _complete_with_k2(
        self,
        prompt: str,
        system: str | None,
    ) -> str:
        if not self._k2_api_key:
            raise RuntimeError("Missing K2_API_KEY for k2-think model call")

        response = await acompletion(
            api_key=self._k2_api_key,
            api_base=_K2_BASE_URL,
            model=_K2_MODEL_ID,
            messages=self._build_messages(prompt=prompt, system=system),
        )
        return self._extract_message_content(response)

    def _build_messages(self, prompt: str, system: str | None) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return messages

    def _lava_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._lava_api_key}",
            "X-API-Key": self._lava_api_key,
            "Content-Type": "application/json",
        }

    def _extract_message_content(self, payload: Any) -> str:
        if hasattr(payload, "model_dump"):
            payload = payload.model_dump()

        if isinstance(payload, dict):
            choices = payload.get("choices") or []
            if choices:
                message = choices[0].get("message") or {}
                content = message.get("content")
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    text_chunks = [
                        item.get("text", "")
                        for item in content
                        if isinstance(item, dict) and item.get("type") == "text"
                    ]
                    if text_chunks:
                        return "\n".join(
                            chunk for chunk in text_chunks if chunk
                        ).strip()

        raise ValueError("LLM response did not contain message content")

    def _normalize_json_response(self, response_text: str) -> str:
        cleaned = response_text.strip()

        # Strip reasoning tags emitted by chain-of-thought models (e.g. k2-think)
        cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()

        # Strip markdown fences
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines:
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        parsed = json.loads(cleaned)
        return json.dumps(parsed)

    def _extract_apollo_results(self, payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]

        if not isinstance(payload, dict):
            return []

        candidate_keys = ("results", "profiles", "people", "contacts", "data")
        for key in candidate_keys:
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
            if isinstance(value, dict):
                nested = self._extract_apollo_results(value)
                if nested:
                    return nested

        return []

    def _normalize_apollo_profile(
        self, profile: dict[str, Any]
    ) -> dict[str, Any] | None:
        title = (
            profile.get("title") or profile.get("job_title") or profile.get("headline")
        )
        company = (
            profile.get("company")
            or profile.get("organization_name")
            or profile.get("account", {}).get("name")
        )
        industry = (
            profile.get("industry")
            or profile.get("organization_industry")
            or profile.get("account", {}).get("industry")
        )

        if not title or not company or not industry:
            return None

        normalized = {
            "title": str(title).strip(),
            "company": str(company).strip(),
            "industry": str(industry).strip(),
        }

        for optional_key in ("name", "linkedin_url", "city", "country"):
            value = profile.get(optional_key)
            if value:
                normalized[optional_key] = value

        return normalized


# ---------------------------------------------------------------------------
# Module-level singleton — the only instance that should exist
# ---------------------------------------------------------------------------
llm_client = LLMClient()
