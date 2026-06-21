import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import settings
from .mock import run_mock
from .routes import points, stats, alerts


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
