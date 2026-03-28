import os
import sys
import unittest
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


from app.core.database import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.schemas.claim import ClaimSchema  # noqa: E402
from app.schemas.market import ClaimsGenerateResponse, MarketResponse  # noqa: E402


class FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeAsyncSession:
    def __init__(self, state) -> None:
        self.state = state
        self.committed = False

    async def execute(self, stmt):
        return FakeScalarResult(self.state.report)

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        return None

    def add(self, row) -> None:
        return None

    def add_all(self, rows) -> None:
        return None

    async def flush(self) -> None:
        return None


class DemoFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = create_app()
        self.client = TestClient(self.app)
        self.market_id = uuid4()
        self.session_id = uuid4()
        self.simulation_id = uuid4()
        self.report_id = uuid4()
        self.state = SimpleNamespace(
            report=None,
            simulation=SimpleNamespace(
                id=self.simulation_id,
                session_id=self.session_id,
                market_id=self.market_id,
                status="building",
                current_tick=0,
                total_ticks=30,
                market=SimpleNamespace(
                    question="Will the Fed cut rates before September?",
                    current_probability=Decimal("0.67"),
                ),
                agents=[
                    SimpleNamespace(
                        id=uuid4(),
                        name="Ava",
                        archetype="quantitative_analyst",
                        initial_belief=Decimal("0.45"),
                        current_belief=Decimal("0.45"),
                        confidence=Decimal("0.60"),
                        professional_background={
                            "title": "Analyst",
                            "company": "Example Research",
                            "industry": "Finance",
                            "apollo_enriched": False,
                        },
                    ),
                    SimpleNamespace(
                        id=uuid4(),
                        name="Blake",
                        archetype="data_skeptic",
                        initial_belief=Decimal("0.50"),
                        current_belief=Decimal("0.50"),
                        confidence=Decimal("0.58"),
                        professional_background={
                            "title": "Economist",
                            "company": "Macro Fund",
                            "industry": "Finance",
                            "apollo_enriched": True,
                        },
                    ),
                ],
                tick_data=[],
                created_at=datetime.now(UTC),
                completed_at=None,
            ),
        )
        self.fake_db = FakeAsyncSession(self.state)

        async def override_db():
            yield self.fake_db

        self.app.dependency_overrides[get_db] = override_db

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_demo_flow_happy_path(self) -> None:
        market_response = MarketResponse(
            id=self.market_id,
            session_id=self.session_id,
            polymarket_id="fed-rate-cut",
            question="Will the Fed cut rates before September?",
            resolution_criteria="YES if at least one cut is announced before September.",
            current_probability=0.67,
            volume=125000.50,
        )
        claims_response = ClaimsGenerateResponse(
            session_id=self.session_id,
            market_id=self.market_id,
            claims=[
                ClaimSchema(
                    id=uuid4(),
                    text="Recent CPI cooled.",
                    stance="yes",
                    strength_score=0.77,
                    novelty_score=0.42,
                ),
                ClaimSchema(
                    id=uuid4(),
                    text="Labor market remains resilient.",
                    stance="no",
                    strength_score=0.64,
                    novelty_score=0.31,
                ),
            ],
        )
        fake_session = SimpleNamespace(
            id=self.session_id,
            market_id=self.market_id,
            market=SimpleNamespace(question=market_response.question),
        )
        fake_agent_records = [
            SimpleNamespace(
                id=str(agent.id),
                name=agent.name,
                archetype=agent.archetype,
                initial_belief=float(agent.initial_belief),
                current_belief=float(agent.current_belief),
                confidence=float(agent.confidence),
                professional_background=agent.professional_background,
                trust_scores={},
            )
            for agent in self.state.simulation.agents
        ]

        def complete_demo_state() -> None:
            self.state.simulation.status = "complete"
            self.state.simulation.current_tick = 30
            self.state.simulation.tick_data = [
                {
                    "tick": 1,
                    "agent_states": [],
                    "claim_shares": [],
                    "trust_updates": [],
                    "faction_clusters": [],
                }
            ]
            self.state.simulation.completed_at = datetime.now(UTC)
            self.state.report = SimpleNamespace(
                id=self.report_id,
                simulation_id=self.simulation_id,
                market_probability=Decimal("0.67"),
                simulation_probability=Decimal("0.58"),
                summary="Simulation suggests the market is slightly overconfident.",
                key_drivers=["cooling CPI", "resilient labor market"],
                faction_analysis="Two factions formed around inflation persistence.",
                trust_insights="Quantitative agents gained influence.",
                recommendation="Wait for another inflation print before sizing up.",
            )

        def fake_create_task(coro):
            complete_demo_state()
            coro.close()
            return SimpleNamespace(done=lambda: True)

        with patch(
            "app.api.routes.markets.market_ingestion_service.import_market",
            AsyncMock(return_value=market_response),
        ):
            market_import = self.client.post(
                "/api/markets/import",
                json={"url": "https://polymarket.com/event/fed-rate-cut"},
            )

        self.assertEqual(market_import.status_code, 200)
        self.assertEqual(market_import.json()["session_id"], str(self.session_id))

        with patch(
            "app.api.routes.claims.claims_generator.generate",
            AsyncMock(return_value=claims_response),
        ):
            claims = self.client.post(f"/api/sessions/{self.market_id}/claims/generate")

        self.assertEqual(claims.status_code, 200)
        self.assertEqual(len(claims.json()["claims"]), 2)

        with patch("app.api.routes.simulations._load_session", AsyncMock(return_value=fake_session)):
            with patch(
                "app.api.routes.simulations._find_latest_simulation",
                AsyncMock(return_value=None),
            ):
                with patch(
                    "app.api.routes.simulations.world_builder.build_world",
                    AsyncMock(return_value=fake_agent_records),
                ):
                    with patch(
                        "app.api.routes.simulations._load_simulation",
                        AsyncMock(return_value=self.state.simulation),
                    ):
                        build_world = self.client.post(
                            "/api/simulations/build-world",
                            json={"session_id": str(self.session_id)},
                        )

        self.assertEqual(build_world.status_code, 200)
        self.assertEqual(build_world.json()["status"], "building")
        self.assertEqual(len(build_world.json()["agents"]), 2)

        with patch(
            "app.api.routes.simulations._load_simulation",
            AsyncMock(side_effect=[self.state.simulation, self.state.simulation]),
        ):
            with patch(
                "app.api.routes.simulations._load_claim_rows",
                AsyncMock(return_value=[]),
            ):
                with patch(
                    "app.api.routes.simulations.run_simulation",
                    AsyncMock(return_value=SimpleNamespace()),
                ):
                    with patch(
                        "app.api.routes.simulations.asyncio.create_task",
                        side_effect=fake_create_task,
                    ):
                        start = self.client.post(f"/api/simulations/{self.simulation_id}/start")

        self.assertEqual(start.status_code, 200)
        self.assertIn(start.json()["status"], {"running", "complete"})

        with patch(
            "app.api.routes.simulations._load_simulation",
            AsyncMock(return_value=self.state.simulation),
        ):
            simulation = self.client.get(f"/api/simulations/{self.simulation_id}")

        self.assertEqual(simulation.status_code, 200)
        self.assertEqual(simulation.json()["id"], str(self.simulation_id))
        self.assertEqual(simulation.json()["status"], "complete")
        self.assertEqual(simulation.json()["current_tick"], 30)

        report = self.client.get(f"/api/reports/{self.simulation_id}")
        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.json()["simulation_id"], str(self.simulation_id))
        self.assertIn("summary", report.json())


if __name__ == "__main__":
    unittest.main()
