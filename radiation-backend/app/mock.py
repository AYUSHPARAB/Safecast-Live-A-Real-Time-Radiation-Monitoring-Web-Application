# app/mock.py
import asyncio
import logging
import random
import time

from .cache import cache
from .ws_manager import manager
from .models import SensorCurrentReading, RadiationAlert, GlobalStats, WSMessage

logger = logging.getLogger(__name__)

# (name, latitude, longitude) — fixed cities so fake sensors land in real places
CITIES = [
    ("Tokyo",     35.6762, 139.6503),
    ("Hamburg",   53.5511,   9.9937),
    ("Fukushima", 37.7608, 140.4747),
]


def cpm_to_level(cpm: float) -> str:
    """Mock decides the level. In the real system, Flink (P3) does this."""
    if cpm < 50:
        return "safe"
    if cpm < 100:
        return "warning"
    if cpm <= 300:
        return "elevated"
    return "high"


def make_reading() -> SensorCurrentReading:
    """Build ONE fake reading. Pure function — easy to reason about and test."""
    city, base_lat, base_lon = random.choice(CITIES)
    lat = round(base_lat + random.uniform(-0.05, 0.05), 5)
    lon = round(base_lon + random.uniform(-0.05, 0.05), 5)
    cpm = round(random.uniform(20, 400), 1)
    device_id = f"{city[:3].upper()}-{random.randint(1, 9999):04d}"

    return SensorCurrentReading(
        captured_at=int(time.time() * 1000),   # milliseconds, per the contract
        cpm=cpm,
        latitude=lat,
        longitude=lon,
        device_id=device_id,
        location_name=city,
        sensor_key=f"dev:{device_id}",
        level=cpm_to_level(cpm),
    )


def make_alert(point: SensorCurrentReading) -> RadiationAlert:
    """Turn a high reading into an alert. level must be warning/elevated/high."""
    return RadiationAlert(
        captured_at=point.captured_at,
        cpm=point.cpm,
        latitude=point.latitude,
        longitude=point.longitude,
        device_id=point.device_id,
        location_name=point.location_name,
        level=point.level,
    )


def make_stats() -> GlobalStats:
    """Fake a global stats snapshot."""
    return GlobalStats(
        avg_cpm=round(random.uniform(30, 150), 1),
        max_cpm=round(random.uniform(150, 400), 1),
        active_sensors=cache.sensor_count() or random.randint(5, 20),
        alert_count=len(cache.recent_alerts),
        reading_count=random.randint(100, 5000),
    )


async def run_mock(interval: float = 1.0) -> None:
    """Forever-loop: runs in the background while FastAPI serves requests."""
    logger.info("Mock generator started (interval=%.1fs)", interval)
    tick = 0
    try:
        while True:

            for _ in range(random.randint(2, 5)):
                try:
                    point = make_reading()
                    cache.put_point(point)
                    await manager.broadcast(
                     WSMessage(channel="current", data=point.model_dump(mode="json")).model_dump()
                    )

                    if point.cpm > 300:
                        alert=make_alert(point)                 # only high readings alert
                        cache.put_alert(alert)
                        await manager.broadcast(
                            WSMessage(channel="alerts", data=alert.model_dump(mode="json")).model_dump()
                        )
                        logger.info(
                            "ALERT %s cpm=%.1f level=%s",
                            point.device_id, point.cpm, point.level,
                        )
                except Exception:
                    logger.exception("Bad reading — skipping")

            if tick % 10 == 0:                          # stats every ~10 ticks
                try:
                    stats = make_stats()
                    cache.put_stats(stats)
                    await manager.broadcast(
                        WSMessage(channel="stats", data=stats.model_dump(mode="json")).model_dump()
                    )
                except Exception:
                    logger.exception("Bad stats — skipping")

            tick += 1
            await asyncio.sleep(interval)
            
    except asyncio.CancelledError:
        logger.info("Mock generator stopped")
        raise
