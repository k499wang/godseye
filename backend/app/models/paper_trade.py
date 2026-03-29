from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Literal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.market import Market
    from app.models.paper_position import PaperPosition
    from app.models.report import Report
    from app.models.simulation import Simulation


PaperTradeSide = Literal["yes", "no"]


class PaperTrade(Base):
    __tablename__ = "paper_trades"
    __table_args__ = (
        CheckConstraint("price > 0 AND price < 1", name="ck_paper_trades_price_range"),
        CheckConstraint("shares > 0", name="ck_paper_trades_shares_positive"),
        CheckConstraint("amount > 0", name="ck_paper_trades_amount_positive"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    position_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("paper_positions.id", ondelete="CASCADE"),
        index=True,
    )
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
    side: Mapped[PaperTradeSide] = mapped_column(
        ENUM("yes", "no", name="paper_side", create_type=False),
        index=True,
    )
    wallet_address: Mapped[str | None] = mapped_column(String(128), nullable=True)
    signed_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    wallet_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    shares: Mapped[Decimal] = mapped_column(Numeric(14, 5))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    position: Mapped["PaperPosition"] = relationship(back_populates="trades")
    market: Mapped["Market"] = relationship()
    simulation: Mapped["Simulation | None"] = relationship()
    report: Mapped["Report | None"] = relationship()
