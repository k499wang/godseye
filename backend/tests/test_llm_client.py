import os
import sys
import types
import unittest
from unittest.mock import patch


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

if "httpx" not in sys.modules:
    httpx_stub = types.ModuleType("httpx")

    class _Timeout:
        def __init__(self, *args, **kwargs) -> None:
            self.args = args
            self.kwargs = kwargs

    class _AsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            self.args = args
            self.kwargs = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

    class _HTTPError(Exception):
        pass

    httpx_stub.Timeout = _Timeout
    httpx_stub.AsyncClient = _AsyncClient
    httpx_stub.HTTPError = _HTTPError
    sys.modules["httpx"] = httpx_stub

if "litellm" not in sys.modules:
    litellm_stub = types.ModuleType("litellm")

    async def _acompletion(*args, **kwargs):
        raise RuntimeError("litellm stub should not be called in these tests")

    litellm_stub.acompletion = _acompletion
    sys.modules["litellm"] = litellm_stub


from app.core.llm_client import (  # noqa: E402
    LLMClient,
    MODEL_GEMINI_FLASH,
)


class LLMClientInitTests(unittest.TestCase):
    def test_prefers_documented_env_vars(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LAVA_API_KEY": "new-lava",
                "LAVA_KEY": "old-lava",
                "TOGETHER_API_KEY": "new-together",
                "TOGETHER_KEY": "old-together",
            },
            clear=True,
        ):
            client = LLMClient()

        self.assertEqual(client._lava_api_key, "new-lava")
        self.assertEqual(client._together_api_key, "new-together")

    def test_falls_back_to_legacy_env_vars(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LAVA_KEY": "old-lava",
                "TOGETHER_KEY": "old-together",
            },
            clear=True,
        ):
            client = LLMClient()

        self.assertEqual(client._lava_api_key, "old-lava")
        self.assertEqual(client._together_api_key, "old-together")

    def test_uses_override_urls_when_present(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LAVA_API_KEY": "lava",
                "LAVA_BASE_URL": "https://example.com/root/",
                "LAVA_CHAT_COMPLETIONS_URL": "https://chat.example.com/v1",
                "LAVA_APOLLO_URL": "https://apollo.example.com/search",
            },
            clear=True,
        ):
            client = LLMClient()

        self.assertEqual(client._lava_base_url, "https://example.com/root")
        self.assertEqual(client._lava_chat_completions_url, "https://chat.example.com/v1")
        self.assertEqual(client._lava_apollo_url, "https://apollo.example.com/search")


class LLMClientHelpersTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = LLMClient()

    def test_extract_message_content_from_string(self) -> None:
        payload = {
            "choices": [
                {
                    "message": {
                        "content": "plain response",
                    }
                }
            ]
        }

        self.assertEqual(self.client._extract_message_content(payload), "plain response")

    def test_extract_message_content_from_chunk_list(self) -> None:
        payload = {
            "choices": [
                {
                    "message": {
                        "content": [
                            {"type": "text", "text": "first chunk"},
                            {"type": "text", "text": "second chunk"},
                        ]
                    }
                }
            ]
        }

        self.assertEqual(
            self.client._extract_message_content(payload),
            "first chunk\nsecond chunk",
        )

    def test_normalize_json_response_accepts_plain_json(self) -> None:
        response = self.client._normalize_json_response('{"a": 1, "b": 2}')
        self.assertEqual(response, '{"a": 1, "b": 2}')

    def test_normalize_json_response_strips_markdown_fences(self) -> None:
        response = self.client._normalize_json_response(
            '```json\n{"claims": [{"text": "x"}]}\n```'
        )
        self.assertEqual(response, '{"claims": [{"text": "x"}]}')

    def test_extract_apollo_results_handles_nested_data(self) -> None:
        payload = {
            "data": {
                "people": [
                    {"title": "Economist", "company": "Acme", "industry": "Finance"},
                ]
            }
        }

        results = self.client._extract_apollo_results(payload)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["company"], "Acme")

    def test_normalize_apollo_profile_maps_common_fields(self) -> None:
        profile = {
            "job_title": "Chief Economist",
            "organization_name": "Brookings",
            "organization_industry": "Think Tank",
            "name": "Alex",
        }

        normalized = self.client._normalize_apollo_profile(profile)
        self.assertEqual(
            normalized,
            {
                "title": "Chief Economist",
                "company": "Brookings",
                "industry": "Think Tank",
                "name": "Alex",
            },
        )

    def test_normalize_apollo_profile_returns_none_when_required_fields_missing(self) -> None:
        profile = {"job_title": "Chief Economist"}
        self.assertIsNone(self.client._normalize_apollo_profile(profile))


class LLMClientAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_complete_raises_for_unsupported_model(self) -> None:
        client = LLMClient()

        with self.assertRaises(ValueError):
            await client.complete(prompt="hello", model="bad-model")

    async def test_complete_raises_when_lava_key_missing(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            client = LLMClient()

        with self.assertRaises(RuntimeError):
            await client.complete(prompt="hello", model=MODEL_GEMINI_FLASH)


if __name__ == "__main__":
    unittest.main()
