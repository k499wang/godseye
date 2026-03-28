from uuid import UUID

from fastapi import APIRouter

from app.api.mock_data import build_report_response
from app.schemas.report import ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{simulation_id}", response_model=ReportResponse)
async def get_report(simulation_id: UUID) -> ReportResponse:
    return build_report_response(simulation_id=simulation_id)
