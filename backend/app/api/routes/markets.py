from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.market import MarketResponse
from app.services.market_ingestion import market_ingestion_service
from app.services.polymarket_client import PolymarketClientError
from pydantic import BaseModel, HttpUrl

router = APIRouter(prefix="/markets", tags=["markets"])


class MarketImportRequest(BaseModel):
    url: HttpUrl


@router.post("/import", response_model=MarketResponse)
async def import_market(
    payload: MarketImportRequest,
    db: AsyncSession = Depends(get_db),
) -> MarketResponse:
    try:
        return await market_ingestion_service.import_market(
            market_url=str(payload.url),
            db=db,
        )
    except PolymarketClientError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"detail": exc.detail, "code": exc.code},
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"detail": "Database write failed", "code": "DATABASE_ERROR"},
        ) from exc
