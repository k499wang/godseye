import sys
from pathlib import Path
from datetime import datetime
from uuid import uuid4

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.claim import ClaimSchema
from app.schemas.market import ClaimsGenerateResponse, MarketResponse
from app.schemas.report import ReportResponse
from app.schemas.simulation import (
    AgentSummary,
    AgentTickState,
    ClaimShareRecord,
    ProfessionalBackground,
    SimulationResponse,
    TickSnapshot,
    TrustUpdate,
)


def test_schema_imports_and_valid_payloads() -> None:
    professional_background = ProfessionalBackground(
        title="Chief Economist",
        company="Example Capital",
        industry="Finance",
        apollo_enriched=True,
    )

    claim = ClaimSchema(
        id=uuid4(),
        text="Labor market data is weakening.",
        stance="yes",
        strength_score=0.72,
        novelty_score=0.55,
    )

    market = MarketResponse(
        id=uuid4(),
        session_id=uuid4(),
        polymarket_id="fed-rate-cut-sept-2025",
        question="Will the Fed cut rates before September 2025?",
        resolution_criteria="Resolves YES if at least one cut is announced before Sept 1 2025.",
        current_probability=0.67,
        volume=125000.50,
    )

    claims_response = ClaimsGenerateResponse(
        session_id=uuid4(),
        market_id=uuid4(),
        claims=[claim],
    )

    agent_summary = AgentSummary(
        id=uuid4(),
        name="Ava",
        archetype="quantitative_analyst",
        initial_belief=0.54,
        current_belief=0.58,
        confidence=0.63,
        professional_background=professional_background,
    )

    agent_tick_state = AgentTickState(
        agent_id=agent_summary.id,
        name=agent_summary.name,
        belief=0.58,
        confidence=0.63,
        action_taken="share_claim",
        reasoning="Labor market softening supports a near-term cut.",
    )

    claim_share = ClaimShareRecord(
        from_agent_id=uuid4(),
        from_agent_name="Ava",
        to_agent_id=uuid4(),
        to_agent_name="Blake",
        claim_id=claim.id,
        claim_text=claim.text,
        commentary="This is the strongest near-term signal.",
        tick=1,
    )

    trust_update = TrustUpdate(
        from_agent_id=uuid4(),
        to_agent_id=uuid4(),
        old_trust=0.61,
        new_trust=0.63,
    )

    tick_snapshot = TickSnapshot(
        tick=1,
        agent_states=[agent_tick_state],
        claim_shares=[claim_share],
        trust_updates=[trust_update],
        faction_clusters=[[agent_summary.id]],
    )

    simulation = SimulationResponse(
        id=uuid4(),
        session_id=market.session_id,
        market_id=claims_response.market_id,
        status="running",
        current_tick=1,
        total_ticks=30,
        agents=[agent_summary],
        tick_data=[tick_snapshot],
        created_at=datetime.utcnow(),
        completed_at=None,
    )

    report = ReportResponse(
        id=uuid4(),
        simulation_id=simulation.id,
        market_probability=0.67,
        simulation_probability=0.58,
        summary="Simulation suggests the market is slightly overconfident.",
        key_drivers=["labor market softening", "sticky inflation"],
        faction_analysis="Two factions formed around inflation persistence.",
        trust_insights="Quantitative agents gained influence over time.",
        recommendation="Monitor incoming inflation data before taking a position.",
    )

    assert market.current_probability == 0.67
    assert claims_response.claims[0].stance == "yes"
    assert simulation.tick_data[0].claim_shares[0].tick == 1
    assert report.simulation_probability == 0.58


def test_schema_validation_failures() -> None:
    try:
        ClaimSchema(
            id=uuid4(),
            text="Invalid claim",
            stance="yes",
            strength_score=1.4,
            novelty_score=0.5,
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("Expected ClaimSchema validation to fail for strength_score > 1.0")

    try:
        MarketResponse(
            id=uuid4(),
            session_id=uuid4(),
            polymarket_id="bad-market",
            question="Bad market",
            resolution_criteria="Bad criteria",
            current_probability=1.2,
            volume=100,
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("Expected MarketResponse validation to fail for current_probability > 1.0")


def main() -> None:
    test_schema_imports_and_valid_payloads()
    test_schema_validation_failures()
    print("schema smoke tests passed")


if __name__ == "__main__":
    main()
