import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
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


async def _fetch_and_cache() -> MarketBrowseResponse:
    """Fetch from Gamma API, geo-enrich via Gemini, populate cache, return response."""
    raw = await polymarket_client.fetch_active_events(limit=80)
    raw = await enrich_with_geo(raw)
    items: list[MarketBrowseItem] = []
    for market in raw:
        market_payload = dict(market)
        market_payload.pop("tag_slugs", None)
        items.append(MarketBrowseItem(**market_payload))
    now = time.time()
    _browse_cache["data"] = items
    _browse_cache["fetched_at"] = now
    return MarketBrowseResponse(markets=items, cached=False, cache_age_seconds=0.0)


@router.get("/browse", response_model=MarketBrowseResponse)
async def browse_markets() -> MarketBrowseResponse:
    """Return active Polymarket events from cache (refreshed every hour)."""
    now = time.time()
    fetched_at = float(_browse_cache["fetched_at"])  # type: ignore[arg-type]
    cached_data = _browse_cache["data"]

    if cached_data is not None and (now - fetched_at) < _BROWSE_CACHE_TTL:
        return MarketBrowseResponse(
            markets=cached_data,  # type: ignore[arg-type]
            cached=True,
            cache_age_seconds=round(now - fetched_at, 1),
        )

    try:
        return await _fetch_and_cache()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"detail": "Failed to fetch markets from Polymarket", "code": "UPSTREAM_UNAVAILABLE"},
        ) from exc


@router.post("/refresh", response_model=MarketBrowseResponse)
async def refresh_markets() -> MarketBrowseResponse:
    """Force-bust the browse cache and fetch fresh markets from Polymarket."""
    try:
        return await _fetch_and_cache()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"detail": "Failed to fetch markets from Polymarket", "code": "UPSTREAM_UNAVAILABLE"},
        ) from exc
