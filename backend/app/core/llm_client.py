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
from typing import Any, Optional

import httpx
from litellm import acompletion

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

_LAVA_BASE_URL = "https://gateway.lavanet.xyz/api/v1"  # adjust if Lava endpoint differs
_K2_MODEL_ID = "together_ai/Kindo/K2-Think-V2"

_JSON_SUFFIX = (
    "\n\nRespond with valid JSON only. Do not include any text outside the JSON object."
)


class LLMClient:
    """
    Unified LLM client.  All callers import the module-level `llm_client` singleton.
    """

    def __init__(self) -> None:
        self._lava_api_key: str = os.getenv("LAVA_API_KEY", "")
        self._together_api_key: str = os.getenv("TOGETHER_API_KEY", "")

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: str = MODEL_GEMINI_FLASH,
        response_format: str = "text",  # "text" or "json"
    ) -> str:
        """
        Call the LLM and return the response as a string.

        If response_format="json", the returned string is valid JSON
        (already parsed and re-serialised to strip markdown fences etc.).
        Caller is responsible for json.loads() if they need a dict.

        STUB: returns placeholder strings until real implementation is wired.
        """
        if response_format == "json":
            return '{"placeholder": true}'
        return "placeholder response"

    async def call_apollo(
        self,
        job_titles: list[str],
        keywords: list[str],
        limit: int = 12,
    ) -> list[dict[str, Any]]:
        """
        Search Apollo.io via Lava and return a list of professional profile dicts.
        Each dict contains at minimum: title, company, industry.
        Returns an empty list if Apollo returns no results or on any error.

        STUB: returns empty list until real implementation is wired.
        """
        return []


# ---------------------------------------------------------------------------
# Module-level singleton — the only instance that should exist
# ---------------------------------------------------------------------------
llm_client = LLMClient()
