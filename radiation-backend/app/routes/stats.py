# app/routes/stats.py
from fastapi import APIRouter

from ..cache import cache

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats/current")
async def get_current_stats():
    return await cache.get_stats()