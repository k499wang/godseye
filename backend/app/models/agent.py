from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Literal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.claim_share import ClaimShare
    from app.models.simulation import Simulation


AgentArchetype = Literal[
    "bayesian_updater",
    "trend_follower",
    "contrarian",
    "data_skeptic",
    "narrative_focused",
    "quantitative_analyst",
]


class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = (
        CheckConstraint("initial_belief >= 0 AND initial_belief <= 1", name="ck_agents_initial_belief_range"),
        CheckConstraint("current_belief >= 0 AND current_belief <= 1", name="ck_agents_current_belief_range"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_agents_confidence_range"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    simulation_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("simulations.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String)
    archetype: Mapped[AgentArchetype] = mapped_column(
        ENUM(
            "bayesian_updater",
            "trend_follower",
            "contrarian",
            "data_skeptic",
            "narrative_focused",
            "quantitative_analyst",
            name="agent_archetype",
            create_type=False,
        ),
        index=True,
    )
    initial_belief: Mapped[Decimal] = mapped_column(Numeric(4, 3))
    current_belief: Mapped[Decimal] = mapped_column(Numeric(4, 3))
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3))
    professional_background: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
    trust_scores: Mapped[dict[str, float]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    simulation: Mapped["Simulation"] = relationship(back_populates="agents")
    sent_claim_shares: Mapped[list["ClaimShare"]] = relationship(
        back_populates="from_agent",
        foreign_keys="ClaimShare.from_agent_id",
    )
    received_claim_shares: Mapped[list["ClaimShare"]] = relationship(
        back_populates="to_agent",
        foreign_keys="ClaimShare.to_agent_id",
    )
