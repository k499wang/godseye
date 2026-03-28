from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.session import AnalysisSession
    from app.models.simulation import Simulation


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    polymarket_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    question: Mapped[str] = mapped_column(Text)
    resolution_criteria: Mapped[str] = mapped_column(Text)
    current_probability: Mapped[Decimal] = mapped_column(Numeric(6, 5))
    volume: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    sessions: Mapped[list["AnalysisSession"]] = relationship(back_populates="market")
    simulations: Mapped[list["Simulation"]] = relationship(back_populates="market")
