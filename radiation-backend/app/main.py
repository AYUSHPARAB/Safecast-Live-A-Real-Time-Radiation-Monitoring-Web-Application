import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .config import settings
from .mock import run_mock
from .routes import points, stats, alerts
from .cache import cache
from .ws_manager import manager
from .models import WSMessage


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- startup ----
    task = None
    if settings.mock_mode:
        task = asyncio.create_task(run_mock())

    yield   # app serves requests here for its whole life

    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Radiation tracking backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(points.router)
app.include_router(stats.router)
app.include_router(alerts.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "mock_mode": settings.mock_mode}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        #send data when the browser connects so the map is not empty
        await ws.send_json(
            WSMessage(channel="map", data={"points": cache.get_all_sensors()}).model_dump()
        )
        latest = cache.get_stats()
        if latest:
            await ws.send_json(WSMessage(channel="stats", data=latest).model_dump())

        # keep the line open — we don't expect messages from the client
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)