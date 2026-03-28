from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    simulation_id: UUID
    market_probability: float = Field(ge=0.0, le=1.0)
    simulation_probability: float = Field(ge=0.0, le=1.0)
    summary: str
    key_drivers: list[str]
    faction_analysis: str
    trust_insights: str
    recommendation: str
