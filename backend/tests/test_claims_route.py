import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


from app.core.database import get_db  # noqa: E402
from app.main import create_app  # noqa: E402


class FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeAsyncSession:
    def __init__(self, analysis_session):
        self.analysis_session = analysis_session

    async def execute(self, stmt):
        return FakeScalarResult(self.analysis_session)


class ClaimsRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = create_app()
        self.market_id = uuid4()
        self.session_id = uuid4()

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_generate_claims_returns_service_response(self) -> None:
        fake_session = FakeAsyncSession(
            analysis_session=SimpleNamespace(id=self.session_id, market_id=self.market_id)
        )

        async def override_db():
            yield fake_session

        self.app.dependency_overrides[get_db] = override_db

        mocked_response = {
            "session_id": str(self.session_id),
            "market_id": str(self.market_id),
            "claims": [
                {
                    "id": str(uuid4()),
                    "text": "Recent CPI cooled",
                    "stance": "yes",
                    "strength_score": 0.77,
                    "novelty_score": 0.42,
                }
            ],
        }

        with patch(
            "app.api.routes.claims.claims_generator.generate",
            AsyncMock(return_value=mocked_response),
        ) as generate_mock:
            client = TestClient(self.app)
            response = client.post(f"/api/sessions/{self.market_id}/claims/generate")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), mocked_response)
        generate_mock.assert_awaited_once()

    def test_generate_claims_returns_404_when_session_missing(self) -> None:
        fake_session = FakeAsyncSession(analysis_session=None)

        async def override_db():
            yield fake_session

        self.app.dependency_overrides[get_db] = override_db

        client = TestClient(self.app)
        response = client.post(f"/api/sessions/{self.market_id}/claims/generate")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {
                "detail": {
                    "detail": "Analysis session not found for market",
                    "code": "SESSION_NOT_FOUND",
                }
            },
        )


if __name__ == "__main__":
    unittest.main()
