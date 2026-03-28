from fastapi import APIRouter

router = APIRouter(prefix="/sessions", tags=["claims"])


@router.get("/_placeholder")
async def claims_placeholder() -> dict[str, str]:
    return {"detail": "claims router scaffolded"}
