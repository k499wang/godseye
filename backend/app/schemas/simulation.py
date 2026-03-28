from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AgentArchetype = Literal[
    "bayesian_updater",
    "trend_follower",
    "contrarian",
    "data_skeptic",
    "narrative_focused",
    "quantitative_analyst",
]

SimulationStatus = Literal["pending", "building", "running", "complete", "failed"]
AgentAction = Literal["update_belief", "share_claim"]


class ProfessionalBackground(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    company: str
    industry: str
    apollo_enriched: bool


class AgentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    archetype: AgentArchetype
    initial_belief: float = Field(ge=0.0, le=1.0)
    current_belief: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    professional_background: ProfessionalBackground


class AgentTickState(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    agent_id: UUID
    name: str
    belief: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    action_taken: AgentAction
    reasoning: str


class ClaimShareRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_agent_id: UUID
    from_agent_name: str
    to_agent_id: UUID
    to_agent_name: str
    claim_id: UUID
    claim_text: str
    commentary: str
    tick: int


class TrustUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_agent_id: UUID
    to_agent_id: UUID
    old_trust: float
    new_trust: float


class TickSnapshot(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tick: int
    agent_states: list[AgentTickState]
    claim_shares: list[ClaimShareRecord]
    trust_updates: list[TrustUpdate]
    faction_clusters: list[list[UUID]]


class SimulationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    market_id: UUID
    status: SimulationStatus
    current_tick: int
    total_ticks: int
    agents: list[AgentSummary]
    tick_data: list[TickSnapshot]
    created_at: datetime
    completed_at: datetime | None
