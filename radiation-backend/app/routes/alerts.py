# app/routes/alerts.py
from fastapi import APIRouter, Query

from ..cache import cache

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts")
def get_alerts(limit: int = Query(default=20, ge=1, le=500)):
    """Most recent alerts first, capped by `limit`."""
    return cache.get_alerts(limit=limit)
