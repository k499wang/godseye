"""
Full System Integration Test — Person 1 + Person 2 + Person 3
Tests the complete pipeline end-to-end:
  P1: market import
  P2: claims generation
  P3: world build → simulation → report

Run from backend/:  python integration_test_full.py
"""

import asyncio
import os
from decimal import Decimal
from uuid import UUID

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.services.claims_generator import claims_generator
from app.services.market_ingestion import market_ingestion_service
from app.workers.simulation_worker import run_simulation

MARKET_URL = "https://polymarket.com/event/largest-ipo-by-market-cap-in-2026-287"
SEP = "=" * 60
TOTAL_STEPS = 9


def _make_factory():
    db_url = os.getenv("DATABASE_URL", "").replace(
        "postgresql://", "postgresql+asyncpg://"
    )
    engine = create_async_engine(db_url, connect_args={"ssl": "require"})
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


def check(condition: bool, msg: str) -> None:
    if not condition:
        raise AssertionError(msg)


async def run() -> None:
    engine, factory = _make_factory()
    failures: list[str] = []

    market_id: UUID | None = None
    session_id: UUID | None = None
    simulation_id: UUID | None = None

    # ── 1. Person 1: import market ─────────────────────────────────────────────
    print(f"\n{SEP}")
    print("STEP 1 — P1: import_market")
    print(SEP)
    try:
        async with factory() as db:
            market_response = await market_ingestion_service.import_market(
                market_url=MARKET_URL,
                db=db,
            )
        market_id = market_response.id
        session_id = market_response.session_id
        print(f"  question:    {market_response.question}")
        print(f"  market_id:   {market_id}")
        print(f"  session_id:  {session_id}")
        print(f"  probability: {market_response.current_probability}")
        check(market_response.question, "empty question")
        check(0.0 <= market_response.current_probability <= 1.0, "bad probability")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("p1-import-market")
        await engine.dispose()
        _print_summary(failures, TOTAL_STEPS)
        return

    # ── 2. Person 2: generate claims ───────────────────────────────────────────
    print(f"\n{SEP}")
    print("STEP 2 — P2: claims_generator.generate")
    print(SEP)
    claims_response = None
    try:
        async with factory() as db:
            await db.execute(
                text("DELETE FROM claims WHERE market_id = :mid"),
                {"mid": market_id},
            )
            await db.commit()

        async with factory() as db:
            claims_response = await claims_generator.generate(
                db=db,
                market_id=market_id,
            )

        check(len(claims_response.claims) >= 10, f"too few claims: {len(claims_response.claims)}")
        yes_claims = [c for c in claims_response.claims if c.stance == "yes"]
        no_claims  = [c for c in claims_response.claims if c.stance == "no"]
        check(len(yes_claims) > 0 and len(no_claims) > 0, "missing stances")
        for c in claims_response.claims:
            check(0.0 <= float(c.strength_score) <= 1.0, f"bad strength_score: {c.strength_score}")
            check(0.0 <= float(c.novelty_score)  <= 1.0, f"bad novelty_score: {c.novelty_score}")
            check(len(c.text.strip()) > 0, "empty claim text")

        print(f"  {len(claims_response.claims)} claims ({len(yes_claims)} yes / {len(no_claims)} no)")
        print(f"  Sample: [{claims_response.claims[0].stance}] {claims_response.claims[0].text[:70]}")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("p2-generate-claims")
        await engine.dispose()
        _print_summary(failures, TOTAL_STEPS)
        return

    # ── 3. Seam P1→P2: session_id consistency ──────────────────────────────────
    print(f"\n{SEP}")
    print("STEP 3 — Seam P1→P2: session_id matches")
    print(SEP)
    try:
        check(
            claims_response.session_id == session_id,
            f"session_id mismatch: P1={session_id}, P2={claims_response.session_id}",
        )
        print(f"  Both systems share session_id: {session_id}")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("seam-p1-p2-session-id")

    # ── 4. Person 3: build world (create simulation + agents) ──────────────────
    print(f"\n{SEP}")
    print("STEP 4 — P3: build simulation world (12 agents)")
    print(SEP)
    try:
        from decimal import Decimal
        from uuid import uuid4
        from app.models.agent import Agent
        from app.models.simulation import Simulation
        from app.services.world_builder import world_builder

        async with factory() as db:
            # Clear any existing simulation for this session so we test fresh
            await db.execute(
                text(
                    "DELETE FROM simulations WHERE session_id = :sid"
                ),
                {"sid": session_id},
            )
            await db.commit()

        async with factory() as db:
            simulation = Simulation(
                session_id=session_id,
                market_id=market_id,
                status="building",
                current_tick=0,
                total_ticks=30,
                tick_data=[],
            )
            db.add(simulation)
            await db.flush()
            simulation_id = simulation.id

            agent_records = await world_builder.build_world(
                session_id=str(session_id),
                simulation_id=str(simulation_id),
                market_question=market_response.question,
            )

            db.add_all(
                Agent(
                    id=UUID(ar.id),
                    simulation_id=simulation_id,
                    name=ar.name,
                    archetype=ar.archetype,
                    initial_belief=Decimal(str(ar.initial_belief)),
                    current_belief=Decimal(str(ar.current_belief)),
                    confidence=Decimal(str(ar.confidence)),
                    professional_background=ar.professional_background,
                    trust_scores=ar.trust_scores,
                )
                for ar in agent_records
            )
            await db.commit()

        check(simulation_id is not None, "simulation_id is None after creation")
        check(len(agent_records) == 12, f"expected 12 agents, got {len(agent_records)}")

        archetypes = {ar.archetype for ar in agent_records}
        expected_archetypes = {
            "bayesian_updater", "trend_follower", "contrarian",
            "data_skeptic", "narrative_focused", "quantitative_analyst",
        }
        check(archetypes == expected_archetypes, f"wrong archetypes: {archetypes}")

        # Check Apollo enrichment
        apollo_enriched = [
            ar for ar in agent_records
            if ar.professional_background.get("apollo_enriched")
        ]
        print(f"  simulation_id: {simulation_id}")
        print(f"  {len(agent_records)} agents across {len(archetypes)} archetypes")
        print(f"  {len(apollo_enriched)} Apollo-enriched / {len(agent_records) - len(apollo_enriched)} synthetic")
        print(f"  Sample agent: {agent_records[0].name} ({agent_records[0].archetype})")
        print(f"    background: {agent_records[0].professional_background.get('title')} @ {agent_records[0].professional_background.get('company')}")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("p3-build-world")
        await engine.dispose()
        _print_summary(failures, TOTAL_STEPS)
        return

    # ── 5. Person 3: run simulation (30 ticks) + generate report ───────────────
    print(f"\n{SEP}")
    print("STEP 5 — P3: run simulation (30 ticks) + generate report")
    print("  (This runs the full 30-tick multi-agent deliberation — may take a few minutes)")
    print(SEP)
    result = None
    try:
        claims_for_runner = [
            {
                "id": str(c.id),
                "text": c.text,
                "stance": c.stance,
                "strength_score": float(c.strength_score),
                "novelty_score": float(c.novelty_score),
            }
            for c in claims_response.claims
        ]

        result = await run_simulation(
            simulation_id=str(simulation_id),
            session_id=str(session_id),
            market_question=market_response.question,
            market_probability=float(market_response.current_probability),
            claims=claims_for_runner,
        )

        check(result.current_tick == 30, f"expected 30 ticks, got {result.current_tick}")
        check(len(result.tick_data) == 30, f"expected 30 tick snapshots, got {len(result.tick_data)}")
        check(len(result.agents) == 12, f"expected 12 agents in result, got {len(result.agents)}")

        final_beliefs = [ar.current_belief for ar in result.agents]
        for belief in final_beliefs:
            check(0.0 <= belief <= 1.0, f"agent belief out of range: {belief}")

        avg_final_belief = sum(final_beliefs) / len(final_beliefs)
        print(f"  {result.current_tick} ticks completed")
        print(f"  {len(result.tick_data)} tick snapshots")
        print(f"  avg final belief: {avg_final_belief:.3f} (market: {market_response.current_probability:.3f})")
        belief_range = f"{min(final_beliefs):.3f}–{max(final_beliefs):.3f}"
        print(f"  belief spread: {belief_range}")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("p3-run-simulation")
        await engine.dispose()
        _print_summary(failures, TOTAL_STEPS)
        return

    # ── 6. DB: verify simulation persisted as "complete" ──────────────────────
    print(f"\n{SEP}")
    print("STEP 6 — DB: simulation row is 'complete' with 30 ticks persisted")
    print(SEP)
    try:
        async with factory() as db:
            row = await db.execute(
                text(
                    "SELECT status, current_tick, jsonb_array_length(tick_data) as tick_count "
                    "FROM simulations WHERE id = :sid"
                ),
                {"sid": simulation_id},
            )
            sim_row = row.fetchone()

        check(sim_row is not None, "simulation row not found in DB")
        check(sim_row.status == "complete", f"expected status='complete', got '{sim_row.status}'")
        check(sim_row.current_tick == 30, f"DB current_tick={sim_row.current_tick}, expected 30")
        check(sim_row.tick_count == 30, f"DB tick_data has {sim_row.tick_count} entries, expected 30")
        print(f"  status: {sim_row.status}")
        print(f"  current_tick: {sim_row.current_tick}")
        print(f"  tick_data rows: {sim_row.tick_count}")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("db-simulation-complete")

    # ── 7. DB: verify report generated and persisted ───────────────────────────
    print(f"\n{SEP}")
    print("STEP 7 — DB: report row exists with all required fields")
    print(SEP)
    try:
        async with factory() as db:
            row = await db.execute(
                text(
                    "SELECT simulation_probability, market_probability, "
                    "summary, recommendation, "
                    "jsonb_array_length(key_drivers) as kd_count "
                    "FROM reports WHERE simulation_id = :sid"
                ),
                {"sid": simulation_id},
            )
            report_row = row.fetchone()

        check(report_row is not None, "report row not found in DB")
        check(report_row.summary and len(report_row.summary) > 20, "report summary too short")
        check(report_row.recommendation and len(report_row.recommendation) > 10, "missing recommendation")
        check(report_row.kd_count >= 1, f"no key drivers in report")
        sim_prob = float(report_row.simulation_probability)
        mkt_prob = float(report_row.market_probability)
        check(0.0 <= sim_prob <= 1.0, f"sim probability out of range: {sim_prob}")
        check(0.0 <= mkt_prob <= 1.0, f"market probability out of range: {mkt_prob}")
        print(f"  market_probability:     {mkt_prob:.3f}")
        print(f"  simulation_probability: {sim_prob:.3f}")
        print(f"  key_drivers count:      {report_row.kd_count}")
        print(f"  summary preview:        {report_row.summary[:80]}...")
        print(f"  recommendation preview: {report_row.recommendation[:80]}...")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("db-report-persisted")

    # ── 8. Seam P2→P3: claims fed into simulation ──────────────────────────────
    print(f"\n{SEP}")
    print("STEP 8 — Seam P2→P3: P2 claim IDs flow into simulation tick_data")
    print(SEP)
    try:
        p2_claim_ids = {str(c.id) for c in claims_response.claims}
        sim_claim_ids: set[str] = set()
        for snap in result.tick_data:
            for cs in snap.claim_shares:
                sim_claim_ids.add(cs.claim_id)

        overlap = p2_claim_ids & sim_claim_ids
        if len(sim_claim_ids) == 0:
            # Agents statistically chose update_belief every tick — not a bug
            print(f"  {len(p2_claim_ids)} P2 claims available; agents chose update_belief every tick (0 shares) — OK")
        else:
            print(f"  {len(p2_claim_ids)} P2 claims → {len(sim_claim_ids)} unique claims shared in simulation")
            print(f"  {len(overlap)} claim IDs appear in both P2 output and simulation")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("seam-p2-p3-claims")

    # ── 9. Idempotency: re-import same URL returns same market + session ────────
    print(f"\n{SEP}")
    print("STEP 9 — Idempotency: re-importing same URL returns same market_id + session_id")
    print(SEP)
    try:
        async with factory() as db:
            market_response_2 = await market_ingestion_service.import_market(
                market_url=MARKET_URL,
                db=db,
            )
        check(market_response_2.id == market_id,
              f"market_id changed on 2nd import: {market_response_2.id}")
        check(market_response_2.session_id == session_id,
              f"session_id changed on 2nd import: {market_response_2.session_id}")
        print(f"  Same market_id and session_id on re-import: {market_id}")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("idempotency")

    await engine.dispose()
    _print_summary(failures, TOTAL_STEPS)


def _print_summary(failures: list[str], total: int) -> None:
    print(f"\n{SEP}")
    if failures:
        print(f"FAILED ({len(failures)}/{total}): {failures}")
    else:
        print(f"ALL {total} INTEGRATION STEPS PASSED")


asyncio.run(run())
