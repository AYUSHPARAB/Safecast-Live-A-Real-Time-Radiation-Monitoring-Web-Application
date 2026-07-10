from fastapi import APIRouter, Query

from ..cache import cache

router = APIRouter(prefix="/api", tags=["spikes"])


@router.get("/spikes")
async def get_spikes(limit: int = Query(default=50, ge=1, le=500)):
    return await cache.get_spikes(limit=limit)
