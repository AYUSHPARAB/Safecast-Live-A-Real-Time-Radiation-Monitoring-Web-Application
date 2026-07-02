# app/ws_manager.py
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    "Holds list of active websocket connections pushes messages to all connected browsers."

    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)
        logger.info("WS connected (%d total)", len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)
            logger.info("WS disconnected (%d left)", len(self.active))

    async def broadcast(self, message: dict) -> None:
        "Send a message to all connected browsers and drop the dead ones."
        dead: list[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
