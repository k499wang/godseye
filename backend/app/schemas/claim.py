from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ClaimStance = Literal["yes", "no"]


class ClaimSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    text: str
    stance: ClaimStance
    strength_score: float = Field(ge=0.0, le=1.0)
    novelty_score: float = Field(ge=0.0, le=1.0)
