from fastapi import APIRouter

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get("/_placeholder")
async def simulations_placeholder() -> dict[str, str]:
    return {"detail": "simulations router scaffolded"}
