"""
Person 1 + Person 2 — Integration Test
Tests the full pipeline: market import → claims generation

Run from backend/:  python integration_test_p1_p2.py
"""

import asyncio
import os

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.services.claims_generator import claims_generator
from app.services.market_ingestion import market_ingestion_service

MARKET_URL = "https://polymarket.com/event/us-forces-enter-iran-by/us-forces-enter-iran-by-april-30-899"
SEP = "=" * 60


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

    # ── 1. Person 1: import market ─────────────────────────────────────────────
    print(f"\n{SEP}")
    print("STEP 1 — Person 1: import_market")
    print(SEP)
    try:
        async with factory() as db:
            market_response = await market_ingestion_service.import_market(
                market_url=MARKET_URL,
                db=db,
            )
        market_id   = market_response.id
        session_id  = market_response.session_id
        print(f"  question:    {market_response.question}")
        print(f"  market_id:   {market_id}")
        print(f"  session_id:  {session_id}")
        print(f"  probability: {market_response.current_probability}")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("p1-import-market")
        await engine.dispose()
        _print_summary(failures, total=5)
        return

    # ── 2. Person 2: generate claims using Person 1's market_id ───────────────
    print(f"\n{SEP}")
    print("STEP 2 — Person 2: claims_generator.generate")
    print(SEP)
    try:
        async with factory() as db:
            # Clear any existing claims so we test a real generation
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
        _print_summary(failures, total=5)
        return

    # ── 3. Verify the seam: session_id must match between the two systems ──────
    print(f"\n{SEP}")
    print("STEP 3 — Seam check: session_id from P1 == session_id in P2 claims response")
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
        failures.append("seam-session-id")

    # ── 4. Verify DB: claims actually persisted with correct foreign keys ───────
    print(f"\n{SEP}")
    print("STEP 4 — DB verification: claims rows have correct market_id + session_id")
    print(SEP)
    try:
        async with factory() as db:
            result = await db.execute(
                text(
                    "SELECT COUNT(*) FROM claims "
                    "WHERE market_id = :mid AND session_id = :sid"
                ),
                {"mid": market_id, "sid": session_id},
            )
            db_count = result.scalar()

        check(db_count == len(claims_response.claims),
              f"DB row count {db_count} != response count {len(claims_response.claims)}")
        print(f"  {db_count} rows in DB with market_id={market_id}")
        print(f"                        and session_id={session_id}")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("db-verification")

    # ── 5. End-to-end idempotency: re-import same URL + re-generate ────────────
    print(f"\n{SEP}")
    print("STEP 5 — Idempotency: same URL + same market_id → same claim IDs")
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

        async with factory() as db:
            claims_response_2 = await claims_generator.generate(
                db=db,
                market_id=market_id,
            )

        ids_1 = {str(c.id) for c in claims_response.claims}
        ids_2 = {str(c.id) for c in claims_response_2.claims}
        check(ids_1 == ids_2, f"different claim IDs on 2nd run: {ids_1 ^ ids_2}")
        print(f"  Same market_id, session_id, and {len(ids_2)} claim IDs on 2nd run")
        print("  PASS")
    except Exception as exc:
        print(f"  FAIL: {exc}")
        failures.append("idempotency")

    await engine.dispose()
    _print_summary(failures, total=5)


def _print_summary(failures: list[str], total: int) -> None:
    print(f"\n{SEP}")
    if failures:
        print(f"FAILED ({len(failures)}/{total}): {failures}")
    else:
        print(f"ALL {total} INTEGRATION STEPS PASSED")


asyncio.run(run())
