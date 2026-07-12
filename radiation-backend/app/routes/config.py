# app/routes/config.py
from fastapi import APIRouter

from ..cache import cache
from ..ws_manager import manager
from ..models import ConfigUpdate, WSMessage
from ..config import settings

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config/threshold")
async def get_threshold():
    value = await cache.get_threshold()
    return {"threshold": value if value is not None else settings.default_threshold}


@router.post("/config/threshold")
async def set_threshold(body: ConfigUpdate):
    await cache.put_threshold(body.threshold)
    await manager.broadcast(
        WSMessage(channel="config", data={"threshold": body.threshold}).model_dump()
    )
    return {"threshold": body.threshold}
