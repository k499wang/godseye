import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal
from app.services.market_ingestion import market_ingestion_service
from app.services.polymarket_client import PolymarketClientError, polymarket_client


def _usage() -> str:
    return (
        "Usage:\n"
        "  python3 tests/polymarket_smoke_test.py <market_url> [--persist]\n\n"
        "Examples:\n"
        "  python3 tests/polymarket_smoke_test.py https://polymarket.com/event/some-market\n"
        "  python3 tests/polymarket_smoke_test.py https://polymarket.com/event/some-market --persist\n"
    )


def _parse_args(argv: list[str]) -> tuple[str, bool]:
    market_url: str | None = None
    persist = False

    for arg in argv[1:]:
        if arg == "--persist":
            persist = True
            continue
        if arg in {"-h", "--help"}:
            print(_usage())
            raise SystemExit(0)
        market_url = arg

    if not market_url:
        print(_usage())
        raise SystemExit(2)

    return market_url, persist


async def _run_live_fetch(*, market_url: str, persist: bool) -> None:
    try:
        snapshot = await polymarket_client.fetch_market(market_url)
    except PolymarketClientError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "stage": "fetch",
                    "status_code": exc.status_code,
                    "error": exc.detail,
                    "code": exc.code,
                },
                indent=2,
            )
        )
        raise SystemExit(1) from exc

    print(
        json.dumps(
            {
                "ok": True,
                "stage": "fetch",
                "market_url": market_url,
                "snapshot": {
                    "polymarket_id": snapshot.polymarket_id,
                    "question": snapshot.question,
                    "resolution_criteria": snapshot.resolution_criteria,
                    "current_probability": float(snapshot.current_probability),
                    "volume": float(snapshot.volume),
                },
            },
            indent=2,
        )
    )

    if not persist:
        return

    try:
        async with SessionLocal() as session:
            response = await market_ingestion_service.import_market(
                market_url=market_url,
                db=session,
            )
    except ValueError as exc:
        if "greenlet" not in str(exc):
            raise
        print(
            json.dumps(
                {
                    "ok": False,
                    "stage": "persist",
                    "error": "greenlet is required for SQLAlchemy async session usage",
                    "code": "MISSING_GREENLET",
                },
                indent=2,
            )
        )
        raise SystemExit(1) from exc

    print(
        json.dumps(
            {
                "ok": True,
                "stage": "persist",
                "market_response": response.model_dump(mode="json"),
            },
            indent=2,
        )
    )


def main() -> None:
    market_url, persist = _parse_args(sys.argv)
    asyncio.run(_run_live_fetch(market_url=market_url, persist=persist))


if __name__ == "__main__":
    main()
