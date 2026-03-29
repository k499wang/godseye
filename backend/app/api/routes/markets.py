import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.market import Market
from app.models.session import AnalysisSession
from app.models.simulation import Simulation
from app.schemas.market import MarketBrowseItem, MarketBrowseResponse, MarketResponse
from app.services.geo_enrichment import enrich_with_geo
from app.services.market_ingestion import market_ingestion_service
from app.services.polymarket_client import PolymarketClientError, polymarket_client
from pydantic import BaseModel, HttpUrl

router = APIRouter(prefix="/markets", tags=["markets"])

# ---------------------------------------------------------------------------
# In-memory browse cache — avoids hammering Gamma API on every page load
# ---------------------------------------------------------------------------
_BROWSE_CACHE_TTL = 3600  # 1 hour

_browse_cache: dict[str, object] = {
    "data": None,
    "fetched_at": 0.0,
}


class MarketImportRequest(BaseModel):
    url: HttpUrl


@router.post("/import", response_model=MarketResponse)
async def import_market(
    payload: MarketImportRequest,
    db: AsyncSession = Depends(get_db),
) -> MarketResponse:
    try:
        return await market_ingestion_service.import_market(
            market_url=str(payload.url),
            db=db,
        )
    except PolymarketClientError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"detail": exc.detail, "code": exc.code},
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"detail": "Database write failed", "code": "DATABASE_ERROR"},
        ) from exc


async def _fetch_and_cache() -> list[dict[str, Any]]:
    """Fetch from Gamma API, geo-enrich, populate cache, return raw browse rows."""
    raw = await polymarket_client.fetch_active_events(limit=80)
    raw = await enrich_with_geo(raw)
    now = time.time()
    _browse_cache["data"] = raw
    _browse_cache["fetched_at"] = now
    return raw


async def _load_market_links(
    *,
    db: AsyncSession,
    slugs: list[str],
) -> dict[str, dict[str, object | None]]:
    if not slugs:
        return {}

    market_rows = (
        await db.execute(
            select(
                Market.polymarket_id,
                Market.id,
                AnalysisSession.id.label("session_id"),
            )
            .outerjoin(AnalysisSession, AnalysisSession.market_id == Market.id)
            .where(Market.polymarket_id.in_(slugs))
        )
    ).all()

    links_by_slug: dict[str, dict[str, object | None]] = {}
    session_ids: list[object] = []
    slug_by_session_id: dict[object, str] = {}

    for polymarket_id, market_id, session_id in market_rows:
        slug = str(polymarket_id)
        links_by_slug[slug] = {
            "is_imported": True,
            "market_id": market_id,
            "session_id": session_id,
            "simulation_id": None,
            "simulation_status": None,
        }
        if session_id is not None:
            session_ids.append(session_id)
            slug_by_session_id[session_id] = slug

    if session_ids:
        simulation_rows = (
            await db.execute(
                select(
                    Simulation.session_id,
                    Simulation.id,
                    Simulation.status,
                )
                .where(Simulation.session_id.in_(session_ids))
                .order_by(Simulation.created_at.desc())
            )
        ).all()

        seen_sessions: set[object] = set()
        for session_id, simulation_id, status in simulation_rows:
            if session_id in seen_sessions:
                continue
            seen_sessions.add(session_id)
            slug = slug_by_session_id.get(session_id)
            if slug is None:
                continue
            link = links_by_slug[slug]
            link["simulation_id"] = simulation_id
            link["simulation_status"] = status

    return links_by_slug


async def _build_browse_response(
    *,
    db: AsyncSession,
    raw_markets: list[dict[str, Any]],
    cached: bool,
    cache_age_seconds: float,
) -> MarketBrowseResponse:
    links_by_slug = await _load_market_links(
        db=db,
        slugs=[str(market.get("slug") or "") for market in raw_markets if market.get("slug")],
    )

    items: list[MarketBrowseItem] = []
    for market in raw_markets:
        market_payload = dict(market)
        market_payload.pop("tag_slugs", None)
        market_payload.update(
            links_by_slug.get(
                str(market_payload.get("slug") or ""),
                {
                    "is_imported": False,
                    "market_id": None,
                    "session_id": None,
                    "simulation_id": None,
                    "simulation_status": None,
                },
            )
        )
        items.append(MarketBrowseItem(**market_payload))

    return MarketBrowseResponse(
        markets=items,
        cached=cached,
        cache_age_seconds=cache_age_seconds,
    )


@router.get("/browse", response_model=MarketBrowseResponse)
async def browse_markets(
    db: AsyncSession = Depends(get_db),
) -> MarketBrowseResponse:
    """Return active Polymarket events from cache (refreshed every hour)."""
    now = time.time()
    fetched_at = float(_browse_cache["fetched_at"])  # type: ignore[arg-type]
    cached_data = _browse_cache["data"]

    if cached_data is not None and (now - fetched_at) < _BROWSE_CACHE_TTL:
        return await _build_browse_response(
            db=db,
            raw_markets=cached_data,  # type: ignore[arg-type]
            cached=True,
            cache_age_seconds=round(now - fetched_at, 1),
        )

    try:
        raw_markets = await _fetch_and_cache()
        return await _build_browse_response(
            db=db,
            raw_markets=raw_markets,
            cached=False,
            cache_age_seconds=0.0,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"detail": "Failed to fetch markets from Polymarket", "code": "UPSTREAM_UNAVAILABLE"},
        ) from exc


@router.post("/refresh", response_model=MarketBrowseResponse)
async def refresh_markets(
    db: AsyncSession = Depends(get_db),
) -> MarketBrowseResponse:
    """Force-bust the browse cache and fetch fresh markets from Polymarket."""
    try:
        raw_markets = await _fetch_and_cache()
        return await _build_browse_response(
            db=db,
            raw_markets=raw_markets,
            cached=False,
            cache_age_seconds=0.0,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"detail": "Failed to fetch markets from Polymarket", "code": "UPSTREAM_UNAVAILABLE"},
        ) from exc
