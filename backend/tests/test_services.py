import json
import os
import sys
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


from app.models.market import Market  # noqa: E402
from app.schemas.simulation import ProfessionalBackground  # noqa: E402
from app.services.apollo_service import ApolloService  # noqa: E402
from app.services.claims_generator import ClaimsGeneratorService  # noqa: E402


class FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeAsyncSession:
    def __init__(self) -> None:
        self.added = []
        self.committed = False
        self.refreshed = []

    async def execute(self, stmt):
        raise AssertionError("execute should not be called in this test")

    def add_all(self, rows) -> None:
        self.added.extend(rows)

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, row) -> None:
        if getattr(row, "id", None) is None:
            row.id = uuid4()
        self.refreshed.append(row)


class ClaimsGeneratorParsingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ClaimsGeneratorService()

    def test_parse_claims_response_accepts_list_payload(self) -> None:
        payload = json.dumps(
            [
                {
                    "text": "Labor market is weakening",
                    "stance": "YES",
                    "strength_score": 0.8,
                    "novelty_score": 0.4,
                }
            ]
        )

        envelope = self.service._parse_claims_response(payload)

        self.assertEqual(len(envelope.claims), 1)
        self.assertEqual(envelope.claims[0].stance, "yes")
        self.assertEqual(envelope.claims[0].text, "Labor market is weakening")

    def test_parse_claims_response_rejects_invalid_stance(self) -> None:
        payload = json.dumps(
            {
                "claims": [
                    {
                        "text": "Bad stance",
                        "stance": "maybe",
                        "strength_score": 0.4,
                        "novelty_score": 0.3,
                    }
                ]
            }
        )

        with self.assertRaises(ValueError):
            self.service._parse_claims_response(payload)


class ClaimsGeneratorAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_generate_persists_claims_and_returns_schema(self) -> None:
        service = ClaimsGeneratorService()
        db = FakeAsyncSession()
        market_id = uuid4()
        session_id = uuid4()
        market = Market(
            polymarket_id="fed-cut",
            question="Will the Fed cut rates?",
            resolution_criteria="YES if any cut is announced.",
            current_probability=Decimal("0.61"),
            volume=Decimal("1000"),
        )

        llm_payload = json.dumps(
            {
                "claims": [
                    {
                        "text": "Recent CPI cooled",
                        "stance": "yes",
                        "strength_score": 0.77,
                        "novelty_score": 0.42,
                    },
                    {
                        "text": "Labor market remains resilient",
                        "stance": "no",
                        "strength_score": 0.64,
                        "novelty_score": 0.31,
                    },
                ]
            }
        )

        with patch.object(service, "_load_market", AsyncMock(return_value=market)):
            with patch(
                "app.services.claims_generator.llm_client.complete",
                AsyncMock(return_value=llm_payload),
            ) as complete_mock:
                response = await service.generate(
                    db=db,
                    market_id=market_id,
                    session_id=session_id,
                )

        self.assertTrue(db.committed)
        self.assertEqual(len(db.added), 2)
        self.assertEqual(len(db.refreshed), 2)
        self.assertEqual(response.market_id, market_id)
        self.assertEqual(response.session_id, session_id)
        self.assertEqual([claim.stance for claim in response.claims], ["yes", "no"])
        self.assertEqual(response.claims[0].text, "Recent CPI cooled")
        complete_mock.assert_awaited_once()


class ApolloServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_build_search_plan_dedupes_titles_and_keywords(self) -> None:
        service = ApolloService()
        raw_payload = json.dumps(
            {
                "job_titles": ["Chief Economist", "chief economist", "Portfolio Manager"],
                "keywords": ["inflation", "Inflation", "fed policy"],
            }
        )

        with patch(
            "app.services.apollo_service.llm_client.complete",
            AsyncMock(return_value=raw_payload),
        ):
            plan = await service._build_search_plan("Will the Fed cut rates?")

        self.assertEqual(plan.job_titles, ["Chief Economist", "Portfolio Manager"])
        self.assertEqual(plan.keywords, ["inflation", "fed policy"])

    async def test_get_relevant_professionals_returns_apollo_only_when_enough_results(self) -> None:
        service = ApolloService()
        search_plan = SimpleNamespace(
            job_titles=["Economist"],
            keywords=["inflation"],
        )
        apollo_profiles = [
            {
                "title": f"Economist {index}",
                "company": f"Firm {index}",
                "industry": "Finance",
            }
            for index in range(6)
        ]

        with patch.object(service, "_build_search_plan", AsyncMock(return_value=search_plan)):
            with patch(
                "app.services.apollo_service.llm_client.call_apollo",
                AsyncMock(return_value=apollo_profiles),
            ):
                with patch.object(
                    service,
                    "_generate_synthetic_profiles",
                    AsyncMock(side_effect=AssertionError("fallback should not run")),
                ):
                    profiles = await service.get_relevant_professionals(
                        market_question="Will the Fed cut rates?",
                        limit=6,
                    )

        self.assertEqual(len(profiles), 6)
        self.assertTrue(all(profile.apollo_enriched for profile in profiles))

    async def test_get_relevant_professionals_falls_back_to_synthetic_profiles(self) -> None:
        service = ApolloService()
        search_plan = SimpleNamespace(
            job_titles=["Economist"],
            keywords=["inflation"],
        )
        apollo_profiles = [
            {
                "title": "Chief Economist",
                "company": "Macro Fund",
                "industry": "Finance",
            }
        ]
        synthetic_profiles = [
            ProfessionalBackground(
                title="Policy Analyst",
                company="Brookings",
                industry="Think Tank",
                apollo_enriched=False,
            ),
            ProfessionalBackground(
                title="Rates Strategist",
                company="Goldman Sachs",
                industry="Banking",
                apollo_enriched=False,
            ),
        ]

        with patch.object(service, "_build_search_plan", AsyncMock(return_value=search_plan)):
            with patch(
                "app.services.apollo_service.llm_client.call_apollo",
                AsyncMock(return_value=apollo_profiles),
            ):
                with patch.object(
                    service,
                    "_generate_synthetic_profiles",
                    AsyncMock(return_value=synthetic_profiles),
                ) as fallback_mock:
                    profiles = await service.get_relevant_professionals(
                        market_question="Will the Fed cut rates?",
                        limit=3,
                    )

        self.assertEqual(len(profiles), 3)
        self.assertTrue(profiles[0].apollo_enriched)
        self.assertFalse(profiles[1].apollo_enriched)
        fallback_mock.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
