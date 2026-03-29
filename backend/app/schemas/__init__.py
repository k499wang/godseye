"""Pydantic schema package."""

from app.schemas.claim import ClaimSchema, ClaimStance
from app.schemas.market import ClaimsGenerateResponse, MarketResponse
from app.schemas.paper_trading import (
    PaperPositionSummary,
    PaperTradeResponse,
    PaperTradingResponse,
    PlacePaperOrderRequest,
)
from app.schemas.report import ReportResponse
from app.schemas.simulation import (
    AgentAction,
    AgentArchetype,
    AgentSummary,
    AgentTickState,
    ClaimShareRecord,
    ProfessionalBackground,
    SimulationResponse,
    SimulationStatus,
    TickSnapshot,
    TrustUpdate,
)

__all__ = [
    "AgentAction",
    "AgentArchetype",
    "AgentSummary",
    "AgentTickState",
    "ClaimSchema",
    "ClaimShareRecord",
    "ClaimsGenerateResponse",
    "ClaimStance",
    "MarketResponse",
    "PaperPositionSummary",
    "PaperTradeResponse",
    "PaperTradingResponse",
    "PlacePaperOrderRequest",
    "ProfessionalBackground",
    "ReportResponse",
    "SimulationResponse",
    "SimulationStatus",
    "TickSnapshot",
    "TrustUpdate",
]
