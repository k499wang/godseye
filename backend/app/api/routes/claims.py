from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.market import ClaimsGenerateResponse
from app.services.claims_generator import (
    ClaimsGeneratorDependencyError,
    ClaimsGeneratorInputError,
    claims_generator,
)

router = APIRouter(prefix="/sessions", tags=["claims"])


async def _rollback_if_possible(db: AsyncSession) -> None:
    rollback = getattr(db, "rollback", None)
    if rollback is not None:
        await rollback()


@router.post("/{market_id}/claims/generate", response_model=ClaimsGenerateResponse)
async def generate_claims(
    market_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ClaimsGenerateResponse:
    try:
        return await claims_generator.generate(db=db, market_id=market_id)
    except ClaimsGeneratorInputError as exc:
        await _rollback_if_possible(db)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": str(exc), "code": "SESSION_NOT_FOUND"},
        ) from exc
    except ClaimsGeneratorDependencyError as exc:
        await _rollback_if_possible(db)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"detail": str(exc), "code": "CLAIMS_GENERATION_UNAVAILABLE"},
        ) from exc
    except ValueError as exc:
        await _rollback_if_possible(db)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": str(exc), "code": "CLAIMS_GENERATION_FAILED"},
        ) from exc
    except SQLAlchemyError as exc:
        await _rollback_if_possible(db)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "Database write failed", "code": "DATABASE_ERROR"},
        ) from exc
