from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..cache import cache

router = APIRouter(prefix="/api", tags=["threshold"])

THRESHOLD_KEY = "config:threshold"


class ThresholdUpdate(BaseModel):
    threshold: float = Field(ge=0, le=10000)


@router.post("/config/threshold")
async def set_threshold(body: ThresholdUpdate):
    await cache.r.set(THRESHOLD_KEY, body.threshold)
    return {"ok": True, "threshold": body.threshold}