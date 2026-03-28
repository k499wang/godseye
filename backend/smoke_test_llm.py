"""
Smoke test — Person 2 live LLM integrations.
Run from backend/:  python smoke_test_llm.py
"""

import asyncio
import json
import os

from dotenv import load_dotenv

load_dotenv()

from app.core.llm_client import (
    MODEL_GEMINI_FLASH,
    MODEL_GEMINI_PRO,
    MODEL_K2_THINK,
    llm_client,
)

SEP = "-" * 60


async def test_gemini_flash() -> None:
    print(f"\n{SEP}")
    print("TEST: gemini-flash (text)")
    response = await llm_client.complete(
        prompt="In one sentence, what is a prediction market?",
        model=MODEL_GEMINI_FLASH,
        response_format="text",
    )
    print(f"RESPONSE: {response}")
    assert isinstance(response, str) and len(response) > 10
    print("PASS")


async def test_gemini_pro_json() -> None:
    print(f"\n{SEP}")
    print("TEST: gemini-pro (json)")
    response = await llm_client.complete(
        prompt=(
            'Return a JSON object with two fields: "model" (string) and "working" (boolean). '
            'Set model to "gemini-pro" and working to true.'
        ),
        model=MODEL_GEMINI_PRO,
        response_format="json",
    )
    print(f"RESPONSE: {response}")
    parsed = json.loads(response)
    assert parsed.get("working") is True
    print("PASS")


async def test_k2_think() -> None:
    print(f"\n{SEP}")
    print("TEST: k2-think (text)")
    response = await llm_client.complete(
        prompt="In one sentence, what is a prediction market?",
        model=MODEL_K2_THINK,
        response_format="text",
    )
    print(f"RESPONSE: {response}")
    assert isinstance(response, str) and len(response) > 10
    print("PASS")


async def test_apollo() -> None:
    print(f"\n{SEP}")
    print("TEST: call_apollo")
    results = await llm_client.call_apollo(
        job_titles=["Economist", "Portfolio Manager"],
        keywords=["interest rates", "Federal Reserve"],
        limit=3,
    )
    print(f"RAW RESULT COUNT: {len(results)}")
    print(f"FIRST RESULT (if any): {results[0] if results else 'empty — fallback will be used'}")
    # Empty is valid — apollo_service falls back to synthetic profiles
    assert isinstance(results, list)
    print("PASS")


async def main() -> None:
    print("Person 2 — Live LLM Smoke Test")

    failures: list[str] = []

    for name, coro in [
        ("gemini-flash", test_gemini_flash()),
        ("gemini-pro json", test_gemini_pro_json()),
        ("k2-think", test_k2_think()),
        ("apollo", test_apollo()),
    ]:
        try:
            await coro
        except Exception as exc:
            print(f"FAIL: {exc}")
            failures.append(name)

    print(f"\n{SEP}")
    if failures:
        print(f"FAILED: {failures}")
    else:
        print("ALL TESTS PASSED")


asyncio.run(main())
