from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.claim import ClaimSchema


class MarketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    polymarket_id: str
    question: str
    resolution_criteria: str
    current_probability: float = Field(ge=0.0, le=1.0)
    volume: float = Field(ge=0.0)


class MarketBrowseItem(BaseModel):
    slug: str
    title: str
    description: str
    url: str
    image: str | None
    volume: float
    volume24hr: float
    probability: float | None  # None for multi-outcome events
    lat: float = 0.0
    lng: float = 0.0
    region: str = "Global"


class MarketBrowseResponse(BaseModel):
    markets: list[MarketBrowseItem]
    cached: bool
    cache_age_seconds: float


class ClaimsGenerateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    market_id: UUID
    claims: list[ClaimSchema]
