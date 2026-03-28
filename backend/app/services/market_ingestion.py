from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market import Market
from app.models.session import AnalysisSession
from app.schemas.market import MarketResponse
from app.services.polymarket_client import (
    PolymarketClient,
    PolymarketMarketSnapshot,
    polymarket_client,
)


def _to_response(market: Market, session: AnalysisSession) -> MarketResponse:
    return MarketResponse(
        id=market.id,
        session_id=session.id,
        polymarket_id=market.polymarket_id,
        question=market.question,
        resolution_criteria=market.resolution_criteria,
        current_probability=float(market.current_probability),
        volume=float(market.volume),
    )


class MarketIngestionService:
    def __init__(self, client: PolymarketClient | None = None) -> None:
        self.client = client or polymarket_client

    async def import_market(self, *, market_url: str, db: AsyncSession) -> MarketResponse:
        snapshot = await self.client.fetch_market(market_url)
        market = await self._find_market(db=db, polymarket_id=snapshot.polymarket_id)

        if market is None:
            market = await self._create_market(db=db, snapshot=snapshot)
        else:
            self._refresh_market(market=market, snapshot=snapshot)

        session = await self._find_session(db=db, market_id=market.id)
        if session is None:
            session = AnalysisSession(market_id=market.id)
            db.add(session)

        await db.commit()
        await db.refresh(market)
        await db.refresh(session)
        return _to_response(market, session)

    async def _find_market(self, *, db: AsyncSession, polymarket_id: str) -> Market | None:
        result = await db.execute(
            select(Market).where(Market.polymarket_id == polymarket_id)
        )
        return result.scalar_one_or_none()

    async def _find_session(self, *, db: AsyncSession, market_id) -> AnalysisSession | None:
        result = await db.execute(
            select(AnalysisSession).where(AnalysisSession.market_id == market_id)
        )
        return result.scalar_one_or_none()

    async def _create_market(
        self,
        *,
        db: AsyncSession,
        snapshot: PolymarketMarketSnapshot,
    ) -> Market:
        market = Market(
            polymarket_id=snapshot.polymarket_id,
            question=snapshot.question,
            resolution_criteria=snapshot.resolution_criteria,
            current_probability=_clamp_probability(snapshot.current_probability),
            volume=max(snapshot.volume, Decimal("0")),
        )
        db.add(market)
        await db.flush()
        return market

    def _refresh_market(
        self,
        *,
        market: Market,
        snapshot: PolymarketMarketSnapshot,
    ) -> None:
        market.question = snapshot.question
        market.resolution_criteria = snapshot.resolution_criteria
        market.current_probability = _clamp_probability(snapshot.current_probability)
        market.volume = max(snapshot.volume, Decimal("0"))


def _clamp_probability(value: Decimal) -> Decimal:
    if value < 0:
        return Decimal("0")
    if value > 1:
        return Decimal("1")
    return value


market_ingestion_service = MarketIngestionService()
