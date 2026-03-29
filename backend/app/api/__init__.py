from fastapi import APIRouter

from app.api.routes.claims import router as claims_router
from app.api.routes.markets import router as markets_router
from app.api.routes.paper_trading import router as paper_trading_router
from app.api.routes.reports import router as reports_router
from app.api.routes.simulations import router as simulations_router

api_router = APIRouter()
api_router.include_router(markets_router)
api_router.include_router(claims_router)
api_router.include_router(simulations_router)
api_router.include_router(reports_router)
api_router.include_router(paper_trading_router)
