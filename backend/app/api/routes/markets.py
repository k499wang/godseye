from fastapi import APIRouter

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/_placeholder")
async def markets_placeholder() -> dict[str, str]:
    return {"detail": "markets router scaffolded"}
