from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.simulation import Simulation


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("market_probability >= 0 AND market_probability <= 1", name="ck_reports_market_probability_range"),
        CheckConstraint(
            "simulation_probability >= 0 AND simulation_probability <= 1",
            name="ck_reports_simulation_probability_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    simulation_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("simulations.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    market_probability: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    simulation_probability: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    summary: Mapped[str] = mapped_column(Text)
    key_drivers: Mapped[list[str]] = mapped_column(JSONB, default=list)
    faction_analysis: Mapped[str] = mapped_column(Text)
    trust_insights: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    simulation: Mapped["Simulation"] = relationship(back_populates="report")
