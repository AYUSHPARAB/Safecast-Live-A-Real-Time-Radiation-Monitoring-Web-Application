from fastapi import APIRouter

from ..cache import cache

router = APIRouter(prefix="/api", tags=["top"])


@router.get("/top")
async def get_top():
    data = await cache.get_top()
    if data is None:
        return {"count": 0, "hotspots": []}
    return data
