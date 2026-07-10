from fastapi import APIRouter

from ..cache import cache

router = APIRouter(prefix="/api", tags=["top"])


@router.get("/top")
async def get_top():
    return await cache.get_top()
