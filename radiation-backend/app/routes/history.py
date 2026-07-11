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
    hours: int = Query(default=24, ge=1, le=48),
):
    """All readings for one sensor in the last N hours."""
    return await db.get_sensor_history(sensor_key=sensor_key, hours=hours)


@router.get("/stats/timeseries")
async def get_timeseries(
    hours: int = Query(default=1, ge=1, le=24),
):
    """Average and max cpm grouped by auto-calculated time interval."""
    allowed = [1, 6, 12, 24]
    if hours not in allowed:
        raise HTTPException(400, f"hours must be one of {allowed}")
    return await db.get_timeseries(hours=hours)


@router.get("/history/alerts")
async def get_alert_history(
    hours: int = Query(default=1, ge=1, le=24),
):
    """All alerts in the last N hours, most recent first."""
    return await db.get_alert_history(hours=hours)
