from fastapi import APIRouter

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/_placeholder")
async def reports_placeholder() -> dict[str, str]:
    return {"detail": "reports router scaffolded"}
