# app/routes/history.py
from fastapi import APIRouter, HTTPException, Query, Path

from .. import db

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/sensors")
async def get_all_sensors():
    """Every sensor ever seen, with its most recent reading."""
    return await db.get_all_sensors()


@router.get("/sensors/{sensor_key}/history")
async def get_sensor_history(
    sensor_key: str = Path(description="e.g. dev:TOK-1234"),
    hours: int = Query(default=24, ge=1, le=720),
):
    """All readings for one sensor in the last N hours."""
    return await db.get_sensor_history(sensor_key=sensor_key, hours=hours)


@router.get("/stats/timeseries")
async def get_timeseries(
    days: int = Query(default=7, ge=1, le=90),
    interval: str = Query(default="1 hour"),
):
    """Average and max cpm grouped by time interval."""
    allowed = ["1 hour", "30 minutes", "6 hours", "1 day"]
    if interval not in allowed:
        raise HTTPException(400, f"interval must be one of {allowed}")
        #raise HTTPException(400, f"interval must be one of {allowed}")
    return await db.get_timeseries(days=days, interval=interval)


@router.get("/history/alerts")
async def get_alert_history(
    days: int = Query(default=30, ge=1, le=365),
):
    """All alerts in the last N days, most recent first."""
    return await db.get_alert_history(days=days)
