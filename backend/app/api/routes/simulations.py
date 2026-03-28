from uuid import UUID

from pydantic import BaseModel

from fastapi import APIRouter

from app.api.mock_data import build_simulation_response
from app.schemas.simulation import SimulationResponse

router = APIRouter(prefix="/simulations", tags=["simulations"])


class BuildWorldRequest(BaseModel):
    session_id: UUID


@router.post("/build-world", response_model=SimulationResponse)
async def build_world(payload: BuildWorldRequest) -> SimulationResponse:
    return build_simulation_response(
        session_id=payload.session_id,
        status="building",
        current_tick=0,
        include_tick_data=False,
    )


@router.post("/{id}/start", response_model=SimulationResponse)
async def start_simulation(id: UUID) -> SimulationResponse:
    return build_simulation_response(
        simulation_id=id,
        status="running",
        current_tick=1,
        include_tick_data=False,
    )


@router.get("/{id}", response_model=SimulationResponse)
async def get_simulation(id: UUID) -> SimulationResponse:
    return build_simulation_response(
        simulation_id=id,
        status="running",
        current_tick=1,
        include_tick_data=True,
    )
