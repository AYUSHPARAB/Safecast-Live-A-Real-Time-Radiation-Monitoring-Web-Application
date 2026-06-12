from fastapi import FastAPI
from .config import settings

app = FastAPI(
    title = "Radiation tracking backend",
    version = "0.1.0",
)

@app.get("/api/health")
def health():
    return {"status": "ok", "mock_mode": settings.mock_mode}

