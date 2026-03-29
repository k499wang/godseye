from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


PaperSide = str


class PlacePaperOrderRequest(BaseModel):
    market_id: UUID
    simulation_id: UUID | None = None
    report_id: UUID | None = None
    side: PaperSide
    amount: float = Field(gt=0)
    wallet_address: str = Field(min_length=1)
    signed_message: str = Field(min_length=1)
    wallet_signature: str = Field(min_length=1)


class PaperTradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    side: PaperSide
    price: float = Field(gt=0, lt=1)
    shares: float = Field(gt=0)
    amount: float = Field(gt=0)
    wallet_address: str | None = None
    signed_message: str | None = None
    wallet_signature: str | None = None
    created_at: datetime


class PaperPositionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    market_id: UUID
    simulation_id: UUID | None
    report_id: UUID | None
    side: PaperSide
    avg_entry_price: float = Field(gt=0, lt=1)
    shares: float = Field(gt=0)
    total_cost: float = Field(gt=0)
    current_price: float = Field(gt=0, lt=1)
    market_probability: float = Field(ge=0, le=1)
    current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    created_at: datetime
    updated_at: datetime


class PaperTradingResponse(BaseModel):
    position: PaperPositionSummary | None
    trades: list[PaperTradeResponse]
