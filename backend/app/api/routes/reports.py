from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.report import Report
from app.schemas.report import ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{simulation_id}", response_model=ReportResponse)
async def get_report(
    simulation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    result = await db.execute(
        select(Report)
        .options(selectinload(Report.simulation))
        .where(Report.simulation_id == simulation_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Report not found", "code": "REPORT_NOT_FOUND"},
        )

    return ReportResponse(
        id=report.id,
        simulation_id=report.simulation_id,
        market_id=report.simulation.market_id,
        market_probability=float(report.market_probability),
        simulation_probability=float(report.simulation_probability),
        summary=report.summary,
        key_drivers=list(report.key_drivers),
        faction_analysis=report.faction_analysis,
        trust_insights=report.trust_insights,
        recommendation=report.recommendation,
    )
