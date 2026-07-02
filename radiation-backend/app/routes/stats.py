# app/routes/stats.py
from fastapi import APIRouter

from ..cache import cache

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats/current")
def get_current_stats():
    """Latest global stats snapshot, or null if none has arrived yet."""
    return cache.get_stats()
