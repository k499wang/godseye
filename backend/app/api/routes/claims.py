from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.session import AnalysisSession
from app.schemas.market import ClaimsGenerateResponse
from app.services.claims_generator import claims_generator


router = APIRouter(prefix="/sessions", tags=["claims"])


@router.post("/{market_id}/claims/generate", response_model=ClaimsGenerateResponse)
async def generate_claims(
    market_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ClaimsGenerateResponse:
    session_stmt = select(AnalysisSession).where(AnalysisSession.market_id == market_id)
    session_result = await db.execute(session_stmt)
    analysis_session = session_result.scalar_one_or_none()

    if analysis_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Analysis session not found for market", "code": "SESSION_NOT_FOUND"},
        )

    try:
        return await claims_generator.generate(
            db=db,
            market_id=market_id,
            session_id=analysis_session.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": str(exc), "code": "CLAIMS_GENERATION_FAILED"},
        ) from exc
