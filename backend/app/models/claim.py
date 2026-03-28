from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Literal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import ENUM, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.claim_share import ClaimShare
    from app.models.market import Market
    from app.models.session import AnalysisSession


ClaimStance = Literal["yes", "no"]


class Claim(Base):
    __tablename__ = "claims"
    __table_args__ = (
        CheckConstraint("strength_score >= 0 AND strength_score <= 1", name="ck_claims_strength_score_range"),
        CheckConstraint("novelty_score >= 0 AND novelty_score <= 1", name="ck_claims_novelty_score_range"),
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
    text: Mapped[str] = mapped_column(Text)
    stance: Mapped[ClaimStance] = mapped_column(
        ENUM("yes", "no", name="claim_stance", create_type=False),
        index=True,
    )
    strength_score: Mapped[Decimal] = mapped_column(Numeric(4, 3))
    novelty_score: Mapped[Decimal] = mapped_column(Numeric(4, 3))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    session: Mapped["AnalysisSession"] = relationship(back_populates="claims")
    market: Mapped["Market"] = relationship()
    claim_shares: Mapped[list["ClaimShare"]] = relationship(back_populates="claim")
