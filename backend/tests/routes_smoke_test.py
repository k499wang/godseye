from datetime import UTC, datetime
from decimal import Decimal
import sys
from pathlib import Path
from types import SimpleNamespace
from types import MethodType
from unittest.mock import AsyncMock, patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from fastapi.testclient import TestClient
except ModuleNotFoundError as exc:
    raise SystemExit(
        "FastAPI is not installed in this Python environment.\n"
        "Install backend dependencies first, then rerun:\n"
        "  pip install fastapi starlette pydantic sqlalchemy asyncpg httpx uvicorn\n"
    ) from exc

from app.core.database import get_db
from app.main import app
from app.schemas.claim import ClaimSchema
from app.schemas.market import ClaimsGenerateResponse
from app.schemas.market import MarketResponse
from app.services.claims_generator import claims_generator
from app.services.market_ingestion import market_ingestion_service


class FakeScalarResult:
    def __init__(self, value) -> None:
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeAsyncSession:
    def __init__(self, *, execute_result=None) -> None:
        self.execute_result = execute_result
        self.added = []
        self.committed = False

    async def execute(self, stmt):
        return FakeScalarResult(self.execute_result)

    def add(self, row) -> None:
        self.added.append(row)

    def add_all(self, rows) -> None:
        self.added.extend(list(rows))

    async def flush(self) -> None:
        for row in self.added:
            if getattr(row, "id", None) is None:
                row.id = uuid4()

    async def commit(self) -> None:
        self.committed = True


def test_healthcheck(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_import_market(client: TestClient) -> None:
    async def fake_import_market(self, *, market_url: str, db) -> MarketResponse:
        assert market_url == "https://polymarket.com/event/fed-rate-cut"
        return MarketResponse(
            id=uuid4(),
            session_id=uuid4(),
            polymarket_id="fed-rate-cut",
            question="Will the Fed cut rates?",
            resolution_criteria="Resolves YES if the Fed cuts rates before the deadline.",
            current_probability=0.67,
            volume=125000.5,
        )

    original_import_market = market_ingestion_service.import_market
    market_ingestion_service.import_market = MethodType(fake_import_market, market_ingestion_service)
    try:
        response = client.post(
            "/api/markets/import",
            json={"url": "https://polymarket.com/event/fed-rate-cut"},
        )
    finally:
        market_ingestion_service.import_market = original_import_market
    body = response.json()

    assert response.status_code == 200
    assert "id" in body
    assert "session_id" in body
    assert body["polymarket_id"] == "fed-rate-cut"
    assert body["current_probability"] == 0.67


def test_import_market_invalid_domain(client: TestClient) -> None:
    response = client.post(
        "/api/markets/import",
        json={"url": "https://example.com/event/not-polymarket"},
    )
    body = response.json()

    assert response.status_code == 422
    assert body["detail"]["code"] == "INVALID_URL"


def test_generate_claims(client: TestClient) -> None:
    market_id = str(uuid4())

    async def fake_generate(self, *, db, market_id):
        return ClaimsGenerateResponse(
            session_id=uuid4(),
            market_id=market_id,
            claims=[
                ClaimSchema(
                    id=uuid4(),
                    text="Labor market softening increases pressure for a cut.",
                    stance="yes",
                    strength_score=0.72,
                    novelty_score=0.55,
                ),
                ClaimSchema(
                    id=uuid4(),
                    text="Sticky inflation reduces the case for near-term easing.",
                    stance="no",
                    strength_score=0.79,
                    novelty_score=0.40,
                ),
            ],
        )

    original_generate = claims_generator.generate
    claims_generator.generate = MethodType(fake_generate, claims_generator)
    try:
        response = client.post(f"/api/sessions/{market_id}/claims/generate")
    finally:
        claims_generator.generate = original_generate

    body = response.json()

    assert response.status_code == 200
    assert body["market_id"] == market_id
    assert len(body["claims"]) == 2
    assert {"yes", "no"} == {claim["stance"] for claim in body["claims"]}


def test_build_world(client: TestClient) -> None:
    session_id = uuid4()
    market_id = uuid4()
    simulation_id = uuid4()
    fake_db = FakeAsyncSession()

    async def override_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_db

    fake_session = SimpleNamespace(
        id=session_id,
        market_id=market_id,
        market=SimpleNamespace(question="Will the Fed cut rates?"),
    )
    fake_agents = [
        SimpleNamespace(
            id=str(uuid4()),
            name="Ava",
            archetype="quantitative_analyst",
            initial_belief=0.45,
            current_belief=0.45,
            confidence=0.60,
            professional_background={
                "title": "Analyst",
                "company": "Example Research",
                "industry": "Finance",
                "apollo_enriched": False,
            },
            trust_scores={},
        ),
        SimpleNamespace(
            id=str(uuid4()),
            name="Blake",
            archetype="data_skeptic",
            initial_belief=0.50,
            current_belief=0.50,
            confidence=0.58,
            professional_background={
                "title": "Economist",
                "company": "Macro Fund",
                "industry": "Finance",
                "apollo_enriched": True,
            },
            trust_scores={},
        ),
    ]
    fake_simulation = SimpleNamespace(
        id=simulation_id,
        session_id=session_id,
        market_id=market_id,
        status="building",
        current_tick=0,
        total_ticks=30,
        agents=[
            SimpleNamespace(
                id=uuid4(),
                name="Ava",
                archetype="quantitative_analyst",
                initial_belief=Decimal("0.45"),
                current_belief=Decimal("0.45"),
                confidence=Decimal("0.60"),
                professional_background=fake_agents[0].professional_background,
            ),
            SimpleNamespace(
                id=uuid4(),
                name="Blake",
                archetype="data_skeptic",
                initial_belief=Decimal("0.50"),
                current_belief=Decimal("0.50"),
                confidence=Decimal("0.58"),
                professional_background=fake_agents[1].professional_background,
            ),
        ],
        tick_data=[],
        created_at=datetime.now(UTC),
        completed_at=None,
    )

    with patch("app.api.routes.simulations._load_session", AsyncMock(return_value=fake_session)):
        with patch("app.api.routes.simulations._find_latest_simulation", AsyncMock(return_value=None)):
            with patch(
                "app.api.routes.simulations.world_builder.build_world",
                AsyncMock(return_value=fake_agents),
            ):
                with patch(
                    "app.api.routes.simulations._load_simulation",
                    AsyncMock(return_value=fake_simulation),
                ):
                    response = client.post(
                        "/api/simulations/build-world",
                        json={"session_id": str(session_id)},
                    )

    app.dependency_overrides.clear()
    body = response.json()

    assert response.status_code == 200
    assert body["session_id"] == str(session_id)
    assert body["status"] == "building"
    assert body["current_tick"] == 0
    assert body["tick_data"] == []
    assert len(body["agents"]) == 2


def test_start_simulation(client: TestClient) -> None:
    simulation_id = uuid4()
    session_id = uuid4()
    market_id = uuid4()
    fake_db = FakeAsyncSession()

    async def override_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_db

    fake_simulation = SimpleNamespace(
        id=simulation_id,
        session_id=session_id,
        market_id=market_id,
        status="running",
        current_tick=1,
        total_ticks=30,
        market=SimpleNamespace(
            question="Will the Fed cut rates?",
            current_probability=Decimal("0.67"),
        ),
        agents=[],
        tick_data=[],
        created_at=datetime.now(UTC),
        completed_at=None,
    )

    with patch(
        "app.api.routes.simulations._load_simulation",
        AsyncMock(side_effect=[fake_simulation, fake_simulation]),
    ):
        with patch("app.api.routes.simulations._load_claim_rows", AsyncMock(return_value=[])):
            with patch("app.api.routes.simulations.asyncio.create_task") as create_task_mock:
                create_task_mock.side_effect = lambda coro: coro.close()
                response = client.post(f"/api/simulations/{simulation_id}/start")

    app.dependency_overrides.clear()
    body = response.json()

    assert response.status_code == 200
    assert body["id"] == str(simulation_id)
    assert body["status"] == "running"
    assert body["current_tick"] == 1
    create_task_mock.assert_called_once()


def test_get_simulation(client: TestClient) -> None:
    simulation_id = uuid4()
    session_id = uuid4()
    market_id = uuid4()
    fake_db = FakeAsyncSession()

    async def override_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_db

    fake_simulation = SimpleNamespace(
        id=simulation_id,
        session_id=session_id,
        market_id=market_id,
        status="running",
        current_tick=1,
        total_ticks=30,
        agents=[],
        tick_data=[
            {
                "tick": 1,
                "agent_states": [],
                "claim_shares": [],
                "trust_updates": [],
                "faction_clusters": [],
            }
        ],
        created_at=datetime.now(UTC),
        completed_at=None,
    )

    with patch(
        "app.api.routes.simulations._load_simulation",
        AsyncMock(return_value=fake_simulation),
    ):
        response = client.get(f"/api/simulations/{simulation_id}")

    app.dependency_overrides.clear()
    body = response.json()

    assert response.status_code == 200
    assert body["id"] == str(simulation_id)
    assert body["status"] == "running"
    assert len(body["tick_data"]) == 1
    assert body["tick_data"][0]["tick"] == 1


def test_get_report(client: TestClient) -> None:
    simulation_id = uuid4()
    fake_report = SimpleNamespace(
        id=uuid4(),
        simulation_id=simulation_id,
        market_probability=Decimal("0.67"),
        simulation_probability=Decimal("0.58"),
        summary="Simulation suggests the market is slightly overconfident.",
        key_drivers=["labor market softening", "sticky inflation"],
        faction_analysis="Two factions formed around inflation persistence.",
        trust_insights="Quantitative agents gained influence over time.",
        recommendation="Monitor incoming inflation data before taking a position.",
    )
    fake_db = FakeAsyncSession(execute_result=fake_report)

    async def override_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_db
    response = client.get(f"/api/reports/{simulation_id}")
    app.dependency_overrides.clear()
    body = response.json()

    assert response.status_code == 200
    assert body["simulation_id"] == str(simulation_id)
    assert "summary" in body
    assert isinstance(body["key_drivers"], list)


def main() -> None:
    client = TestClient(app)
    test_healthcheck(client)
    test_import_market(client)
    test_import_market_invalid_domain(client)
    test_generate_claims(client)
    test_build_world(client)
    test_start_simulation(client)
    test_get_simulation(client)
    test_get_report(client)
    print("route smoke tests passed")


if __name__ == "__main__":
    main()
