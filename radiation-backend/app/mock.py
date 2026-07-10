# app/mock.py
import asyncio
import logging
import random
import time

from .cache import cache
from .ws_manager import manager
from . import db
from .config import settings
from .models import SensorCurrentReading, RadiationAlert, GlobalStats, WSMessage

logger = logging.getLogger(__name__)

CITIES = [
    ("Tokyo",     "Japan",   35.6762, 139.6503),
    ("Hamburg",   "Germany", 53.5511,   9.9937),
    ("Fukushima", "Japan",   37.7608, 140.4747),
]


def cpm_to_level(cpm: float) -> str:
    if cpm < 50:
        return "safe"
    if cpm < 100:
        return "warning"
    if cpm <= 300:
        return "elevated"
    return "high"


def make_reading() -> SensorCurrentReading:
    city, country, base_lat, base_lon = random.choice(CITIES)
    lat = round(base_lat + random.uniform(-0.05, 0.05), 5)
    lon = round(base_lon + random.uniform(-0.05, 0.05), 5)
    cpm = round(random.uniform(20, 400), 1)
    sensor_key = f"{random.randint(0, 0xFFFFFFFF):08X}"   # hex like real sensor_key
    return SensorCurrentReading(
        captured_at=int(time.time() * 1000),
        cpm=cpm,
        latitude=lat,
        longitude=lon,
        sensor_key=sensor_key,
        city=city,
        country=country,
        level=cpm_to_level(cpm),
    )


def make_alert(point: SensorCurrentReading) -> RadiationAlert:
    return RadiationAlert(
        captured_at=point.captured_at,
        cpm=point.cpm,
        latitude=point.latitude,
        longitude=point.longitude,
        sensor_key=point.sensor_key,
        city=point.city,
        country=point.country,
        level=point.level,
    )


async def make_stats() -> GlobalStats:
    active = await cache.sensor_count()
    alerts = await cache.get_alerts(limit=settings.max_alerts)
    return GlobalStats(
        avg_cpm=round(random.uniform(30, 150), 1),
        max_cpm=round(random.uniform(150, 400), 1),
        active_sensors=active or random.randint(5, 20),
        alert_count=len(alerts),
        reading_count=random.randint(100, 5000),
    )


async def run_mock(interval: float = 1.0) -> None:
    logger.info("Mock generator started (interval=%.1fs)", interval)
    tick = 0
    try:
        while True:

            for _ in range(random.randint(2, 5)):
                try:
                    point = make_reading()
                    await cache.put_point(point)
                    await db.insert_reading(point)
                    await manager.broadcast(
                        WSMessage(channel="current",
                                  data=point.model_dump(mode="json")).model_dump()
                    )
                    if point.cpm > 300:
                        alert = make_alert(point)
                        await cache.put_alert(alert)
                        await db.insert_alert(alert)
                        await manager.broadcast(
                            WSMessage(channel="alerts",
                                      data=alert.model_dump(mode="json")).model_dump()
                        )
                except Exception:
                    logger.exception("Bad reading — skipping")

            if tick % 10 == 0:
                try:
                    stats = await make_stats()
                    await cache.put_stats(stats)
                    await manager.broadcast(
                        WSMessage(channel="stats",
                                  data=stats.model_dump(mode="json")).model_dump()
                    )
                except Exception:
                    logger.exception("Bad stats — skipping")

            tick += 1
            await asyncio.sleep(interval)

    except asyncio.CancelledError:
        logger.info("Mock generator stopped")
        raise
    