import asyncio
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import SessionLocal, get_db
from app.models.agent import Agent
from app.models.claim import Claim
from app.models.market import Market
from app.models.session import AnalysisSession
from app.models.simulation import Simulation
from app.schemas.simulation import (
    AgentSummary,
    ProfessionalBackground,
    SimulationResponse,
    TickSnapshot,
)
from app.services.world_builder import world_builder
from app.workers.simulation_worker import run_simulation

router = APIRouter(prefix="/simulations", tags=["simulations"])


class BuildWorldRequest(BaseModel):
    session_id: UUID


@router.post("/build-world", response_model=SimulationResponse)
async def build_world(
    payload: BuildWorldRequest,
    demo: bool = Query(False, description="Demo mode: skip LLM profile generation"),
    db: AsyncSession = Depends(get_db),
) -> SimulationResponse:
    session = await _load_session(db=db, session_id=payload.session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Analysis session not found", "code": "SESSION_NOT_FOUND"},
        )

    existing_simulation = await _find_latest_simulation(db=db, session_id=payload.session_id)
    if existing_simulation is not None:
        return _to_simulation_response(existing_simulation)

    simulation = Simulation(
        session_id=session.id,
        market_id=session.market_id,
        status="building",
        current_tick=0,
        total_ticks=30,
        tick_data=[],
    )
    db.add(simulation)

    try:
        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "Failed to build simulation world", "code": "DATABASE_ERROR"},
        ) from exc

    asyncio.create_task(
        _build_world_background(
            simulation_id=simulation.id,
            session_id=session.id,
            market_question=session.market.question,
            demo=demo,
        )
    )

    simulation = await _load_simulation(db=db, simulation_id=simulation.id)
    if simulation is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "Simulation not found after creation", "code": "SIMULATION_NOT_FOUND"},
        )
    return _to_simulation_response(simulation)


@router.post("/{id}/start", response_model=SimulationResponse)
async def start_simulation(
    id: UUID,
    demo: bool = Query(False, description="Demo mode: run 10 ticks instead of 30"),
    db: AsyncSession = Depends(get_db),
) -> SimulationResponse:
    simulation = await _load_simulation(db=db, simulation_id=id)
    if simulation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Simulation not found", "code": "SIMULATION_NOT_FOUND"},
        )

    # Starting a simulation should be idempotent from the client's perspective.
    # If the sim is already active or finished, return its current state instead
    # of queueing duplicate workers.
    if simulation.status in {"running", "complete"}:
        return _to_simulation_response(simulation)

    total_ticks = 10 if demo else 30
    simulation.status = "running"
    simulation.total_ticks = total_ticks
    await db.commit()

    claim_rows = await _load_claim_rows(db=db, session_id=simulation.session_id)
    asyncio.create_task(
        run_simulation(
            simulation_id=str(simulation.id),
            session_id=str(simulation.session_id),
            market_question=simulation.market.question,
            market_probability=float(simulation.market.current_probability),
            claims=[
                {
                    "id": str(claim.id),
                    "text": claim.text,
                    "stance": claim.stance,
                    "strength_score": float(claim.strength_score),
                    "novelty_score": float(claim.novelty_score),
                }
                for claim in claim_rows
            ],
            total_ticks=total_ticks,
        )
    )

    simulation = await _load_simulation(db=db, simulation_id=id)
    if simulation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Simulation not found", "code": "SIMULATION_NOT_FOUND"},
        )
    return _to_simulation_response(simulation)


@router.get("/{id}", response_model=SimulationResponse)
async def get_simulation(
    id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SimulationResponse:
    simulation = await _load_simulation(db=db, simulation_id=id)
    if simulation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Simulation not found", "code": "SIMULATION_NOT_FOUND"},
        )
    return _to_simulation_response(simulation)


async def _load_session(
    *,
    db: AsyncSession,
    session_id: UUID,
) -> AnalysisSession | None:
    result = await db.execute(
        select(AnalysisSession)
        .options(selectinload(AnalysisSession.market))
        .where(AnalysisSession.id == session_id)
    )
    return result.scalar_one_or_none()


async def _find_latest_simulation(
    *,
    db: AsyncSession,
    session_id: UUID,
) -> Simulation | None:
    result = await db.execute(
        select(Simulation)
        .options(
            selectinload(Simulation.agents),
            selectinload(Simulation.market),
        )
        .where(Simulation.session_id == session_id)
        .order_by(Simulation.created_at.desc())
    )
    return result.scalars().first()


async def _load_simulation(
    *,
    db: AsyncSession,
    simulation_id: UUID,
) -> Simulation | None:
    result = await db.execute(
        select(Simulation)
        .options(
            selectinload(Simulation.agents),
            selectinload(Simulation.market),
        )
        .where(Simulation.id == simulation_id)
    )
    return result.scalar_one_or_none()


async def _load_claim_rows(
    *,
    db: AsyncSession,
    session_id: UUID,
) -> list[Claim]:
    result = await db.execute(
        select(Claim)
        .where(Claim.session_id == session_id)
        .order_by(Claim.created_at.asc(), Claim.id.asc())
    )
    return list(result.scalars().all())


def _to_simulation_response(simulation: Simulation) -> SimulationResponse:
    return SimulationResponse(
        id=simulation.id,
        session_id=simulation.session_id,
        market_id=simulation.market_id,
        status=simulation.status,
        current_tick=simulation.current_tick,
        total_ticks=simulation.total_ticks,
        agents=[
            AgentSummary(
                id=agent.id,
                name=agent.name,
                archetype=agent.archetype,
                initial_belief=float(agent.initial_belief),
                current_belief=float(agent.current_belief),
                confidence=float(agent.confidence),
                professional_background=ProfessionalBackground.model_validate(
                    agent.professional_background
                ),
            )
            for agent in simulation.agents
        ],
        tick_data=[
            TickSnapshot.model_validate(snapshot)
            for snapshot in (simulation.tick_data or [])
        ],
        created_at=simulation.created_at,
        completed_at=simulation.completed_at,
    )


async def _build_world_background(
    *,
    simulation_id: UUID,
    session_id: UUID,
    market_question: str,
    demo: bool = False,
) -> None:
    async with SessionLocal() as db:
        try:
            simulation = await _load_simulation(db=db, simulation_id=simulation_id)
            if simulation is None:
                return
            if simulation.agents:
                if simulation.status == "building":
                    simulation.status = "pending"
                    await db.commit()
                return

            agent_records = await world_builder.build_world(
                session_id=str(session_id),
                simulation_id=str(simulation_id),
                market_question=market_question,
                skip_llm_profiles=demo,
            )

            db.add_all(
                Agent(
                    id=UUID(agent_record.id),
                    simulation_id=simulation_id,
                    name=agent_record.name,
                    archetype=agent_record.archetype,
                    initial_belief=Decimal(str(agent_record.initial_belief)),
                    current_belief=Decimal(str(agent_record.current_belief)),
                    confidence=Decimal(str(agent_record.confidence)),
                    professional_background=agent_record.professional_background,
                    trust_scores=agent_record.trust_scores,
                )
                for agent_record in agent_records
            )
            simulation.status = "pending"
            await db.commit()
        except Exception:
            await db.rollback()
            simulation = await db.get(Simulation, simulation_id)
            if simulation is not None:
                simulation.status = "failed"
                await db.commit()
