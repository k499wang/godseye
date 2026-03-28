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


class ClaimsGenerateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    market_id: UUID
    claims: list[ClaimSchema]
