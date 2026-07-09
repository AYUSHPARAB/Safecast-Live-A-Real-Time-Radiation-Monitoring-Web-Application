import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .mock import run_mock
from .routes import points, stats, alerts, history
from .cache import cache
from .ws_manager import manager
from .models import WSMessage
from . import db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):

    try:
        await cache.ping()
        logger.info("Connected to Redis at %s", settings.redis_url)
    except Exception:
        logger.exception("Could not reach Redis at %s", settings.redis_url)

    try:
        await db.connect()
    except Exception:
        logger.exception("Could not reach the database at %s", settings.database_url)

    task = None
    if settings.mock_mode:
        task = asyncio.create_task(run_mock())
    else:
        from .consumer import run_consumer
        task = asyncio.create_task(run_consumer())

    yield

    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    await db.close_db()
    await cache.close()


app = FastAPI(title="Radiation tracking backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(points.router)
app.include_router(stats.router)
app.include_router(alerts.router)
app.include_router(history.router)


@app.get("/api/health")
async def health():
    try:
        redis_ok = await cache.ping()
    except Exception:
        redis_ok = False
    return {"status": "ok", "mock_mode": settings.mock_mode, "redis": redis_ok}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        await ws.send_json(
            WSMessage(channel="map", data={"points": await cache.get_all_sensors()}).model_dump()
        )
        heat = await cache.get_all_heat()
        if heat:
            await ws.send_json(WSMessage(channel="heatmap", data={"cells": heat}).model_dump())
        latest = await cache.get_stats()
        if latest:
            await ws.send_json(WSMessage(channel="stats", data=latest).model_dump())

        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        logger.exception("WS error — dropping connection")
        manager.disconnect(ws)
