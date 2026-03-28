import sys
from pathlib import Path
from types import MethodType
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

from app.main import app
from app.schemas.market import MarketResponse
from app.services.market_ingestion import market_ingestion_service


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
    response = client.post(f"/api/sessions/{market_id}/claims/generate")
    body = response.json()

    assert response.status_code == 200
    assert body["market_id"] == market_id
    assert len(body["claims"]) == 2
    assert {"yes", "no"} == {claim["stance"] for claim in body["claims"]}


def test_build_world(client: TestClient) -> None:
    session_id = str(uuid4())
    response = client.post(
        "/api/simulations/build-world",
        json={"session_id": session_id},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["session_id"] == session_id
    assert body["status"] == "building"
    assert body["current_tick"] == 0
    assert body["tick_data"] == []
    assert len(body["agents"]) == 2


def test_start_simulation(client: TestClient) -> None:
    simulation_id = str(uuid4())
    response = client.post(f"/api/simulations/{simulation_id}/start")
    body = response.json()

    assert response.status_code == 200
    assert body["id"] == simulation_id
    assert body["status"] == "running"
    assert body["current_tick"] == 1


def test_get_simulation(client: TestClient) -> None:
    simulation_id = str(uuid4())
    response = client.get(f"/api/simulations/{simulation_id}")
    body = response.json()

    assert response.status_code == 200
    assert body["id"] == simulation_id
    assert body["status"] == "running"
    assert len(body["tick_data"]) == 1
    assert body["tick_data"][0]["tick"] == 1


def test_get_report(client: TestClient) -> None:
    simulation_id = str(uuid4())
    response = client.get(f"/api/reports/{simulation_id}")
    body = response.json()

    assert response.status_code == 200
    assert body["simulation_id"] == simulation_id
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
