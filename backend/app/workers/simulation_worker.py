"""
Simulation Worker — Person 3

Orchestrator that runs the full pipeline with DB integration:
  1. world_builder.build_world()  → 12 agents  → persist to DB
  2. simulation_runner.run()      → 30-tick sim → persist tick_data + claim_shares
  3. report_agent.generate()      → final report → persist to DB

Usage (wired by Person 1 into POST /api/simulations/{id}/start):
    from app.workers.simulation_worker import run_simulation
    asyncio.create_task(run_simulation(simulation_id=..., session_id=..., market_question=...))

Works without a DB too (smoke tests, standalone mode) — DB ops are best-effort.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.services.world_builder import world_builder
from app.services.simulation_runner import (
    simulation_runner,
    Claim,
    SimulationResult,
    TickSnapshot,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_simulation(
    simulation_id: str,
    session_id: str,
    market_question: str = "",
    market_probability: float = 0.5,
    claims: list[dict[str, Any]] | None = None,
    total_ticks: int = 30,
) -> SimulationResult:
    """
    Full pipeline: build world -> run simulation -> persist results.

    Parameters:
        simulation_id: Unique simulation identifier.
        session_id: The analysis session ID (for loading claims from DB).
        market_question: The prediction market question text.
        claims: Optional list of claim dicts. If None, loads from DB or uses stubs.

    Returns:
        SimulationResult with complete tick_data.
    """
    db = await _get_db_session()

    try:
        # --- Phase 1: Load or build world ---
        agents = await _load_agents_from_db(db, simulation_id)
        if agents:
            logger.info("Loaded %d existing agents for simulation %s", len(agents), simulation_id)
        else:
            await _update_sim_status(db, simulation_id, "building")
            logger.info("Building world for simulation %s", simulation_id)
            agents = await world_builder.build_world(
                session_id=session_id,
                simulation_id=simulation_id,
                market_question=market_question,
            )
            logger.info("World built: %d agents created", len(agents))

            # Persist agents to DB
            await _persist_agents(db, simulation_id, agents)

        # --- Phase 2: Prepare Claims ---
        claim_objects: list[Claim] | None = None
        if claims:
            claim_objects = [
                Claim(
                    id=str(c.get("id", "")),
                    text=c.get("text", ""),
                    stance=c.get("stance", "yes"),
                    strength_score=float(c.get("strength_score", 0.5)),
                    novelty_score=float(c.get("novelty_score", 0.5)),
                )
                for c in claims
            ]
        else:
            claim_objects = await _load_claims_from_db(db, session_id)

        # --- Phase 3: Run Simulation ---
        await _update_sim_status(db, simulation_id, "running")
        result = await simulation_runner.run(
            simulation_id=simulation_id,
            agents=agents,
            claims=claim_objects,
            market_question=market_question,
            total_ticks=total_ticks,
            on_tick_complete=(
                (lambda snapshot, current_agents: _persist_tick(
                    db,
                    simulation_id,
                    snapshot,
                    current_agents,
                )) if db else None
            ),
        )
        logger.info("Simulation %s complete: %d ticks", simulation_id, result.current_tick)

        # --- Phase 4: Persist Results ---
        await _persist_results(db, simulation_id, result)

        # --- Phase 5: Generate Report ---
        report_data = await _generate_report(
            db, simulation_id, result, market_question, market_probability,
        )
        if report_data:
            logger.info("Report generated for simulation %s", simulation_id)

        return result

    except Exception:
        logger.exception("Simulation %s failed", simulation_id)
        await _update_sim_status(db, simulation_id, "failed")
        raise
    finally:
        if db:
            await db.close()


# ---------------------------------------------------------------------------
# DB helpers (all no-op when db is None)
# ---------------------------------------------------------------------------

async def _get_db_session():
    """Get a DB session, or None if DB is unavailable."""
    try:
        from app.core.database import SessionLocal
        return SessionLocal()
    except Exception:
        logger.debug("DB unavailable — running in memory-only mode")
        return None


async def _update_sim_status(db, simulation_id: str, status: str) -> None:
    if not db:
        return
    try:
        from app.models.simulation import Simulation
        sim = await db.get(Simulation, UUID(simulation_id))
        if sim:
            sim.status = status
            if status == "complete":
                sim.completed_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception as e:
        logger.warning("Failed to update simulation status: %s", e)
        try:
            await db.rollback()
        except Exception:
            pass


async def _persist_agents(db, simulation_id: str, agents) -> None:
    if not db:
        return
    try:
        from app.models.agent import Agent
        for ar in agents:
            db.add(Agent(
                id=UUID(ar.id),
                simulation_id=UUID(simulation_id),
                name=ar.name,
                archetype=ar.archetype,
                initial_belief=ar.initial_belief,
                current_belief=ar.current_belief,
                confidence=ar.confidence,
                professional_background=ar.professional_background,
                trust_scores=ar.trust_scores,
            ))
        await db.commit()
    except Exception as e:
        logger.warning("Failed to persist agents: %s", e)
        try:
            await db.rollback()
        except Exception:
            pass


async def _load_claims_from_db(db, session_id: str) -> list[Claim] | None:
    """Load claims from DB. Returns None if DB unavailable or no claims found."""
    if not db:
        return None
    try:
        from sqlalchemy import select
        from app.models.claim import Claim as ClaimModel

        result = await db.execute(
            select(ClaimModel).where(ClaimModel.session_id == UUID(session_id))
        )
        db_claims = result.scalars().all()
        if not db_claims:
            return None
        return [
            Claim(
                id=str(c.id),
                text=c.text,
                stance=c.stance,
                strength_score=float(c.strength_score),
                novelty_score=float(c.novelty_score),
            )
            for c in db_claims
        ]
    except Exception as e:
        logger.warning("Failed to load claims from DB: %s", e)
        try:
            await db.rollback()
        except Exception:
            pass
        return None


async def _load_agents_from_db(db, simulation_id: str):
    """Load existing persisted agents if build-world already ran."""
    if not db:
        return None
    try:
        from sqlalchemy import select
        from app.models.agent import Agent as AgentModel
        from app.services.world_builder import AgentRecord

        result = await db.execute(
            select(AgentModel).where(AgentModel.simulation_id == UUID(simulation_id))
        )
        db_agents = result.scalars().all()
        if not db_agents:
            return None

        return [
            AgentRecord(
                id=str(agent.id),
                simulation_id=str(agent.simulation_id),
                name=agent.name,
                archetype=agent.archetype,
                initial_belief=float(agent.initial_belief),
                current_belief=float(agent.current_belief),
                confidence=float(agent.confidence),
                professional_background=dict(agent.professional_background or {}),
                trust_scores={
                    str(key): float(value)
                    for key, value in (agent.trust_scores or {}).items()
                },
            )
            for agent in db_agents
        ]
    except Exception as e:
        logger.warning("Failed to load agents from DB: %s", e)
        try:
            await db.rollback()
        except Exception:
            pass
        return None


async def _persist_results(db, simulation_id: str, result: SimulationResult) -> None:
    """Persist final tick_data and updated agents to DB."""
    if not db:
        return
    try:
        from app.models.agent import Agent
        from app.models.simulation import Simulation

        sim = await db.get(Simulation, UUID(simulation_id))
        if sim:
            sim.status = "complete"
            sim.current_tick = result.current_tick
            sim.tick_data = _convert_tick_data(result.tick_data)
            sim.completed_at = datetime.now(timezone.utc)

        # Update agents with final beliefs and trust scores
        for ar in result.agents:
            db_agent = await db.get(Agent, UUID(ar.id))
            if db_agent:
                db_agent.current_belief = ar.current_belief
                db_agent.confidence = ar.confidence
                db_agent.trust_scores = ar.trust_scores

        await db.commit()
    except Exception as e:
        logger.warning("Failed to persist results: %s", e)
        try:
            await db.rollback()
        except Exception:
            pass


async def _persist_tick(
    db,
    simulation_id: str,
    snapshot: TickSnapshot,
    agents,
) -> None:
    """Persist one completed tick so the UI can observe progress in real time."""
    if not db:
        return
    try:
        from sqlalchemy import select
        from app.models.agent import Agent
        from app.models.claim import Claim as ClaimModel
        from app.models.claim_share import ClaimShare
        from app.models.simulation import Simulation

        sim = await db.get(Simulation, UUID(simulation_id))
        if sim is None:
            return

        existing_tick_data = list(sim.tick_data or [])
        if sim.current_tick < snapshot.tick:
            existing_tick_data.append(_convert_tick_data([snapshot])[0])
            sim.tick_data = existing_tick_data
            sim.current_tick = snapshot.tick

        for ar in agents:
            db_agent = await db.get(Agent, UUID(ar.id))
            if db_agent:
                db_agent.current_belief = ar.current_belief
                db_agent.confidence = ar.confidence
                db_agent.trust_scores = ar.trust_scores

        existing_shares = (
            await db.execute(
                select(ClaimShare).where(
                    ClaimShare.simulation_id == UUID(simulation_id),
                    ClaimShare.tick_number == snapshot.tick,
                )
            )
        ).scalars().all()
        share_claim_ids = {UUID(cs.claim_id) for cs in snapshot.claim_shares}
        existing_claims = (
            await db.execute(
                select(ClaimModel).where(ClaimModel.id.in_(share_claim_ids))
            )
        ).scalars().all() if share_claim_ids else []
        existing_claim_ids = {claim.id for claim in existing_claims}
        existing_share_keys = {
            (
                str(share.from_agent_id),
                str(share.to_agent_id),
                str(share.claim_id),
                int(share.tick_number),
            )
            for share in existing_shares
        }

        for cs in snapshot.claim_shares:
            share_key = (cs.from_agent_id, cs.to_agent_id, cs.claim_id, cs.tick)
            if share_key in existing_share_keys:
                continue
            try:
                claim_uuid = UUID(cs.claim_id)
                if claim_uuid not in existing_claim_ids:
                    db.add(ClaimModel(
                        id=claim_uuid,
                        session_id=sim.session_id,
                        market_id=sim.market_id,
                        text=cs.claim_text,
                        stance=cs.claim_stance,
                        strength_score=cs.claim_strength_score,
                        novelty_score=cs.claim_novelty_score,
                    ))
                    existing_claim_ids.add(claim_uuid)
                db.add(ClaimShare(
                    simulation_id=UUID(simulation_id),
                    from_agent_id=UUID(cs.from_agent_id),
                    to_agent_id=UUID(cs.to_agent_id),
                    claim_id=claim_uuid,
                    commentary=cs.commentary,
                    tick_number=cs.tick,
                    delivered=True,
                ))
            except (ValueError, Exception) as share_err:
                logger.warning(
                    "Skipping invalid claim_share on tick %s: from=%s to=%s claim=%s error=%s",
                    cs.tick, cs.from_agent_id, cs.to_agent_id, cs.claim_id, share_err,
                )
                await db.rollback()
                # Re-fetch sim to reattach after rollback
                sim = await db.get(Simulation, UUID(simulation_id))
                if sim is None:
                    return
                continue

        await db.commit()
    except Exception as e:
        logger.warning("Failed to persist tick %s for simulation %s: %s", snapshot.tick, simulation_id, e)
        try:
            await db.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Schema conversion
# ---------------------------------------------------------------------------

def _convert_tick_data(tick_data: list[TickSnapshot]) -> list[dict[str, Any]]:
    """Convert internal TickSnapshots to JSON dicts matching Person 1's schema."""
    from app.schemas.simulation import (
        AgentTickState as AgentTickStateSchema,
        ClaimShareRecord as ClaimShareSchema,
        TrustUpdate as TrustUpdateSchema,
        TickSnapshot as TickSnapshotSchema,
    )
    return [
        TickSnapshotSchema(
            tick=snap.tick,
            agent_states=[
                AgentTickStateSchema(
                    agent_id=UUID(s.agent_id),
                    name=s.name,
                    belief=s.belief,
                    confidence=s.confidence,
                    action_taken=s.action_taken,
                    reasoning=s.reasoning,
                )
                for s in snap.agent_states
            ],
            claim_shares=[
                ClaimShareSchema(
                    from_agent_id=UUID(cs.from_agent_id),
                    from_agent_name=cs.from_agent_name,
                    to_agent_id=UUID(cs.to_agent_id),
                    to_agent_name=cs.to_agent_name,
                    claim_id=UUID(cs.claim_id),
                    claim_text=cs.claim_text,
                    commentary=cs.commentary,
                    tick=cs.tick,
                )
                for cs in snap.claim_shares
            ],
            trust_updates=[
                TrustUpdateSchema(
                    from_agent_id=UUID(tu.from_agent_id),
                    to_agent_id=UUID(tu.to_agent_id),
                    old_trust=tu.old_trust,
                    new_trust=tu.new_trust,
                )
                for tu in snap.trust_updates
            ],
            faction_clusters=[
                [UUID(aid) for aid in cluster]
                for cluster in snap.faction_clusters
            ],
        ).model_dump(mode="json")
        for snap in tick_data
    ]


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

async def _generate_report(
    db,
    simulation_id: str,
    result: SimulationResult,
    market_question: str,
    market_probability: float,
) -> Any:
    """Generate and persist the report. Returns ReportData or None on failure."""
    try:
        from app.services.report_agent import report_agent, ReportData

        report_data = await report_agent.generate(
            simulation_id=simulation_id,
            result=result,
            market_question=market_question,
            market_probability=market_probability,
        )

        # Persist to DB
        await _persist_report(db, report_data)

        return report_data
    except Exception as e:
        logger.warning("Report generation failed: %s", e)
        return None


async def _persist_report(db, report_data) -> None:
    """Save report to DB. No-op if DB unavailable."""
    if not db:
        return
    try:
        from app.models.report import Report

        db.add(Report(
            id=UUID(report_data.id),
            simulation_id=UUID(report_data.simulation_id),
            market_probability=report_data.market_probability,
            simulation_probability=report_data.simulation_probability,
            summary=report_data.summary,
            key_drivers=report_data.key_drivers,
            faction_analysis=report_data.faction_analysis,
            trust_insights=report_data.trust_insights,
            recommendation=report_data.recommendation,
        ))
        await db.commit()
    except Exception as e:
        logger.warning("Failed to persist report: %s", e)
        try:
            await db.rollback()
        except Exception:
            pass
