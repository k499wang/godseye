from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.agent import Agent
    from app.models.claim import Claim
    from app.models.simulation import Simulation


class ClaimShare(Base):
    __tablename__ = "claim_shares"
    __table_args__ = (
        CheckConstraint("tick_number >= 1 AND tick_number <= 30", name="ck_claim_shares_tick_number_range"),
        CheckConstraint("from_agent_id <> to_agent_id", name="ck_claim_shares_distinct_agents"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    simulation_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("simulations.id", ondelete="CASCADE"),
        index=True,
    )
    from_agent_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        index=True,
    )
    to_agent_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        index=True,
    )
    claim_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("claims.id", ondelete="CASCADE"),
        index=True,
    )
    commentary: Mapped[str] = mapped_column(Text)
    tick_number: Mapped[int] = mapped_column(Integer)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    simulation: Mapped["Simulation"] = relationship(back_populates="claim_shares")
    from_agent: Mapped["Agent"] = relationship(
        back_populates="sent_claim_shares",
        foreign_keys=[from_agent_id],
    )
    to_agent: Mapped["Agent"] = relationship(
        back_populates="received_claim_shares",
        foreign_keys=[to_agent_id],
    )
    claim: Mapped["Claim"] = relationship(back_populates="claim_shares")
