from uuid import UUID, uuid5

from fastapi import APIRouter

from app.api.mock_data import build_claims_response
from app.schemas.market import ClaimsGenerateResponse

router = APIRouter(prefix="/sessions", tags=["claims"])

NAMESPACE_CLAIMS = UUID("11111111-1111-1111-1111-111111111111")


@router.post("/{market_id}/claims/generate", response_model=ClaimsGenerateResponse)
async def generate_claims(market_id: UUID) -> ClaimsGenerateResponse:
    session_id = uuid5(NAMESPACE_CLAIMS, str(market_id))
    return build_claims_response(market_id=market_id, session_id=session_id)
