from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.agent import Agent
    from app.models.claim_share import ClaimShare
    from app.models.market import Market
    from app.models.report import Report
    from app.models.session import AnalysisSession


SimulationStatus = Literal["pending", "building", "running", "complete", "failed"]


class Simulation(Base):
    __tablename__ = "simulations"
    __table_args__ = (
        CheckConstraint("current_tick >= 0 AND current_tick <= 30", name="ck_simulations_current_tick_range"),
        CheckConstraint("total_ticks = 30", name="ck_simulations_total_ticks_fixed"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("analysis_sessions.id", ondelete="CASCADE"),
        index=True,
    )
    market_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("markets.id", ondelete="CASCADE"),
        index=True,
    )
    status: Mapped[SimulationStatus] = mapped_column(
        ENUM(
            "pending",
            "building",
            "running",
            "complete",
            "failed",
            name="simulation_status",
            create_type=False,
        ),
        default="pending",
        index=True,
    )
    current_tick: Mapped[int] = mapped_column(Integer, default=0)
    total_ticks: Mapped[int] = mapped_column(Integer, default=30)
    tick_data: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["AnalysisSession"] = relationship(back_populates="simulations")
    market: Mapped["Market"] = relationship(back_populates="simulations")
    agents: Mapped[list["Agent"]] = relationship(back_populates="simulation")
    claim_shares: Mapped[list["ClaimShare"]] = relationship(back_populates="simulation")
    report: Mapped["Report | None"] = relationship(back_populates="simulation")
