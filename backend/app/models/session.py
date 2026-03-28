from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.claim import Claim
    from app.models.market import Market
    from app.models.simulation import Simulation


class AnalysisSession(Base):
    __tablename__ = "analysis_sessions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    market_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("markets.id", ondelete="CASCADE"),
        index=True,
        unique=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    market: Mapped["Market"] = relationship(back_populates="sessions")
    claims: Mapped[list["Claim"]] = relationship(back_populates="session")
    simulations: Mapped[list["Simulation"]] = relationship(back_populates="session")


Session = AnalysisSession
