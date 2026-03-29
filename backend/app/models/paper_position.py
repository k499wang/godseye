from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Literal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.market import Market
    from app.models.paper_trade import PaperTrade
    from app.models.report import Report
    from app.models.simulation import Simulation


PaperSide = Literal["yes", "no"]


class PaperPosition(Base):
    __tablename__ = "paper_positions"
    __table_args__ = (
        CheckConstraint("avg_entry_price > 0 AND avg_entry_price < 1", name="ck_paper_positions_avg_entry_price_range"),
        CheckConstraint("shares > 0", name="ck_paper_positions_shares_positive"),
        CheckConstraint("total_cost > 0", name="ck_paper_positions_total_cost_positive"),
        UniqueConstraint(
            "market_id",
            "simulation_id",
            "report_id",
            name="uq_paper_positions_market_simulation_report",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    market_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("markets.id", ondelete="CASCADE"),
        index=True,
    )
    simulation_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("simulations.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    report_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    side: Mapped[PaperSide] = mapped_column(
        ENUM("yes", "no", name="paper_side", create_type=False),
        index=True,
    )
    avg_entry_price: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    shares: Mapped[Decimal] = mapped_column(Numeric(14, 5))
    total_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    market: Mapped["Market"] = relationship()
    simulation: Mapped["Simulation | None"] = relationship()
    report: Mapped["Report | None"] = relationship()
    trades: Mapped[list["PaperTrade"]] = relationship(back_populates="position")
