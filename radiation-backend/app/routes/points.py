# app/routes/points.py
from fastapi import APIRouter, Query, HTTPException

from ..cache import cache

router = APIRouter(prefix="/api", tags=["points"])


@router.get("/points")
async def get_points(
    min_cpm: float | None = Query(default=None, ge=0),
    bbox: str | None = Query(default=None, description="min_lon,min_lat,max_lon,max_lat"),
    limit: int = Query(default=500, ge=1, le=1000)
):
    points = await cache.get_all_sensors()
    if min_cpm is not None:
        points = [p for p in points if p["cpm"] >= min_cpm]

    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = (float(x) for x in bbox.split(","))
        except ValueError:
            raise HTTPException(400, "bbox must be 'min_lon,min_lat,max_lon,max_lat'")
        points = [
            p for p in points
            if min_lat <= p["latitude"] <= max_lat and min_lon <= p["longitude"] <= max_lon
        ]
    return points[:limit]
