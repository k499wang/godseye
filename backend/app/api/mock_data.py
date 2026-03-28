from datetime import UTC, datetime
from uuid import UUID, uuid4

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


def build_market_response(*, market_id: UUID | None = None, session_id: UUID | None = None) -> MarketResponse:
    return MarketResponse(
        id=market_id or uuid4(),
        session_id=session_id or uuid4(),
        polymarket_id="fed-rate-cut-sept-2025",
        question="Will the Fed cut rates before September 2025?",
        resolution_criteria="Resolves YES if at least one rate cut is announced before Sept 1 2025.",
        current_probability=0.67,
        volume=125000.50,
    )


def build_claims_response(*, market_id: UUID, session_id: UUID | None = None) -> ClaimsGenerateResponse:
    return ClaimsGenerateResponse(
        session_id=session_id or uuid4(),
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


def build_agent_summaries(*, count: int = 2) -> list[AgentSummary]:
    archetypes = [
        "quantitative_analyst",
        "data_skeptic",
        "trend_follower",
        "contrarian",
        "bayesian_updater",
        "narrative_focused",
    ]
    names = ["Ava", "Blake", "Casey", "Drew", "Evan", "Frankie"]
    agents: list[AgentSummary] = []
    for index in range(count):
        agents.append(
            AgentSummary(
                id=uuid4(),
                name=names[index % len(names)],
                archetype=archetypes[index % len(archetypes)],
                initial_belief=0.45 + (index * 0.05),
                current_belief=0.45 + (index * 0.05),
                confidence=0.60,
                professional_background=ProfessionalBackground(
                    title="Analyst",
                    company="Example Research",
                    industry="Finance",
                    apollo_enriched=False,
                ),
            )
        )
    return agents


def build_simulation_response(
    *,
    simulation_id: UUID | None = None,
    session_id: UUID | None = None,
    market_id: UUID | None = None,
    status: str,
    current_tick: int,
    include_tick_data: bool,
) -> SimulationResponse:
    agents = build_agent_summaries(count=2)
    tick_data: list[TickSnapshot] = []

    if include_tick_data:
        tick_data = [
            TickSnapshot(
                tick=1,
                agent_states=[
                    AgentTickState(
                        agent_id=agents[0].id,
                        name=agents[0].name,
                        belief=0.58,
                        confidence=0.63,
                        action_taken="share_claim",
                        reasoning="Labor data is the strongest near-term argument for a cut.",
                    ),
                    AgentTickState(
                        agent_id=agents[1].id,
                        name=agents[1].name,
                        belief=0.46,
                        confidence=0.70,
                        action_taken="update_belief",
                        reasoning="Inflation still outweighs the softer labor data.",
                    ),
                ],
                claim_shares=[
                    ClaimShareRecord(
                        from_agent_id=agents[0].id,
                        from_agent_name=agents[0].name,
                        to_agent_id=agents[1].id,
                        to_agent_name=agents[1].name,
                        claim_id=uuid4(),
                        claim_text="Labor market softening increases pressure for a cut.",
                        commentary="This is the strongest near-term signal.",
                        tick=1,
                    )
                ],
                trust_updates=[
                    TrustUpdate(
                        from_agent_id=agents[0].id,
                        to_agent_id=agents[1].id,
                        old_trust=0.61,
                        new_trust=0.63,
                    )
                ],
                faction_clusters=[[agents[0].id], [agents[1].id]],
            )
        ]

    return SimulationResponse(
        id=simulation_id or uuid4(),
        session_id=session_id or uuid4(),
        market_id=market_id or uuid4(),
        status=status,
        current_tick=current_tick,
        total_ticks=30,
        agents=agents,
        tick_data=tick_data,
        created_at=datetime.now(UTC),
        completed_at=datetime.now(UTC) if status == "complete" else None,
    )


def build_report_response(*, simulation_id: UUID) -> ReportResponse:
    return ReportResponse(
        id=uuid4(),
        simulation_id=simulation_id,
        market_probability=0.67,
        simulation_probability=0.58,
        summary="The simulation converged below market pricing after agents weighted inflation risk against softer labor data.",
        key_drivers=[
            "slowing employment growth",
            "persistent inflation",
            "dovish central bank language",
        ],
        faction_analysis="Two factions formed: one expecting a near-term cut, one expecting inflation to delay easing.",
        trust_insights="Quantitative and data-skeptic agents became more influential as the run progressed.",
        recommendation="Treat current market pricing as slightly overconfident until fresh inflation data arrives.",
    )
