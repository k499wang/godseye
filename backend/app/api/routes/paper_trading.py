from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.market import Market
from app.models.paper_position import PaperPosition
from app.models.paper_trade import PaperTrade
from app.models.report import Report
from app.models.simulation import Simulation
from app.schemas.paper_trading import (
    PaperPositionSummary,
    PaperTradeResponse,
    PaperTradingResponse,
    PlacePaperOrderRequest,
)

router = APIRouter(prefix="/paper-trading", tags=["paper-trading"])

MONEY_QUANT = Decimal("0.01")
PRICE_QUANT = Decimal("0.00001")
SHARES_QUANT = Decimal("0.00001")


@router.get("/reports/{report_id}", response_model=PaperTradingResponse)
async def get_report_paper_trading(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> PaperTradingResponse:
    result = await db.execute(
        select(Report)
        .options(
            selectinload(Report.simulation).selectinload(Simulation.market)
        )
        .where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Report not found", "code": "REPORT_NOT_FOUND"},
        )

    position = await _load_position(
        db=db,
        market_id=report.simulation.market_id,
        simulation_id=report.simulation_id,
        report_id=report.id,
    )
    return await _build_response(db=db, position=position, market=report.simulation.market)


@router.post("/orders", response_model=PaperTradingResponse)
async def place_paper_order(
    payload: PlacePaperOrderRequest,
    db: AsyncSession = Depends(get_db),
) -> PaperTradingResponse:
    market = await db.get(Market, payload.market_id)
    if market is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Market not found", "code": "MARKET_NOT_FOUND"},
        )

    report = None
    if payload.report_id is not None:
        report = await db.get(Report, payload.report_id)
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"detail": "Report not found", "code": "REPORT_NOT_FOUND"},
            )

    side = payload.side.lower()
    if side not in {"yes", "no"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Side must be yes or no", "code": "INVALID_SIDE"},
        )

    market_probability = Decimal(str(market.current_probability))
    entry_price = market_probability if side == "yes" else (Decimal("1") - market_probability)
    if entry_price <= 0 or entry_price >= 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Market probability is not tradable", "code": "INVALID_MARKET_PRICE"},
        )

    amount = Decimal(str(payload.amount)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)
    shares = (amount / entry_price).quantize(SHARES_QUANT, rounding=ROUND_HALF_UP)

    position = await _load_position(
        db=db,
        market_id=payload.market_id,
        simulation_id=payload.simulation_id,
        report_id=payload.report_id,
    )

    if position is None:
        position = PaperPosition(
            market_id=payload.market_id,
            simulation_id=payload.simulation_id,
            report_id=payload.report_id,
            side=side,
            avg_entry_price=entry_price.quantize(PRICE_QUANT, rounding=ROUND_HALF_UP),
            shares=shares,
            total_cost=amount,
        )
        db.add(position)
        await db.flush()
    else:
        if position.side != side:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "detail": "This paper position already exists on the opposite side. Start a new analysis context to switch sides.",
                    "code": "OPPOSITE_SIDE_POSITION",
                },
            )

        new_total_cost = Decimal(str(position.total_cost)) + amount
        new_shares = Decimal(str(position.shares)) + shares
        position.total_cost = new_total_cost.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)
        position.shares = new_shares.quantize(SHARES_QUANT, rounding=ROUND_HALF_UP)
        position.avg_entry_price = (new_total_cost / new_shares).quantize(
            PRICE_QUANT,
            rounding=ROUND_HALF_UP,
        )

    trade = PaperTrade(
        position_id=position.id,
        market_id=payload.market_id,
        simulation_id=payload.simulation_id,
        report_id=payload.report_id,
        side=side,
        price=entry_price.quantize(PRICE_QUANT, rounding=ROUND_HALF_UP),
        shares=shares,
        amount=amount,
    )
    db.add(trade)
    await db.commit()
    await db.refresh(position)

    return await _build_response(db=db, position=position, market=market)


async def _load_position(
    *,
    db: AsyncSession,
    market_id: UUID,
    simulation_id: UUID | None,
    report_id: UUID | None,
) -> PaperPosition | None:
    result = await db.execute(
        select(PaperPosition)
        .options(selectinload(PaperPosition.trades))
        .where(PaperPosition.market_id == market_id)
        .where(PaperPosition.simulation_id == simulation_id)
        .where(PaperPosition.report_id == report_id)
    )
    return result.scalar_one_or_none()


async def _build_response(
    *,
    db: AsyncSession,
    position: PaperPosition | None,
    market: Market,
) -> PaperTradingResponse:
    if position is None:
        return PaperTradingResponse(position=None, trades=[])

    if "trades" not in position.__dict__:
        await db.refresh(position, attribute_names=["trades"])

    trades = sorted(position.trades, key=lambda trade: trade.created_at, reverse=True)
    market_probability = float(market.current_probability)
    current_price = market_probability if position.side == "yes" else (1 - market_probability)
    current_value = float(Decimal(str(position.shares)) * Decimal(str(current_price)))
    total_cost = float(position.total_cost)
    unrealized_pnl = current_value - total_cost
    unrealized_pnl_pct = (unrealized_pnl / total_cost) if total_cost else 0.0

    return PaperTradingResponse(
        position=PaperPositionSummary(
            id=position.id,
            market_id=position.market_id,
            simulation_id=position.simulation_id,
            report_id=position.report_id,
            side=position.side,
            avg_entry_price=float(position.avg_entry_price),
            shares=float(position.shares),
            total_cost=total_cost,
            current_price=current_price,
            market_probability=market_probability,
            current_value=current_value,
            unrealized_pnl=unrealized_pnl,
            unrealized_pnl_pct=unrealized_pnl_pct,
            created_at=position.created_at,
            updated_at=position.updated_at,
        ),
        trades=[
            PaperTradeResponse(
                id=trade.id,
                side=trade.side,
                price=float(trade.price),
                shares=float(trade.shares),
                amount=float(trade.amount),
                created_at=trade.created_at,
            )
            for trade in trades
        ],
    )
