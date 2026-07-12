from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..cache import cache

router = APIRouter(prefix="/api", tags=["ingestion-speed"])

SPEED_KEY = "speed_multiplier"


class SpeedUpdate(BaseModel):
    multiplier: float = Field(ge=0)


@router.post("/config/speed")
async def set_speed(body: SpeedUpdate):
    await cache.r.set(SPEED_KEY, body.multiplier)
    return {"ok": True, "multiplier": body.multiplier}


@router.get("/config/speed")
async def get_speed():
    v = await cache.r.get(SPEED_KEY)
    return {"multiplier": float(v) if v is not None else None}