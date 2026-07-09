import asyncio
import json
import logging

from aiokafka import AIOKafkaConsumer

from .cache import cache
from .ws_manager import manager
from .config import settings
from . import db
from .models import (
    SensorCurrentReading, RadiationAlert, GlobalStats, HeatmapCell, WSMessage,
)

logger = logging.getLogger(__name__)


async def run_consumer() -> None:
    consumer = AIOKafkaConsumer(
        settings.topic_clean,
        settings.topic_current,
        settings.topic_alerts,
        settings.topic_stats,
        settings.topic_heatmap,
        bootstrap_servers=settings.kafka_bootstrap,
        group_id=settings.kafka_group,
        value_deserializer=lambda b: json.loads(b.decode("utf-8")),
        auto_offset_reset="latest",
        enable_auto_commit=True,
    )

    while True:
        try:
            await consumer.start()
            break
        except Exception:
            logger.warning("Kafka not reachable yet — retrying in 3s")
            await asyncio.sleep(3)

    logger.info("Kafka consumer started (current/alerts/stats/heatmap)")

    try:
        async for msg in consumer:
            try:
                if msg.topic == settings.topic_clean:
                    reading = SensorCurrentReading(**msg.value)
                    await db.insert_reading(reading)
                
                elif msg.topic == settings.topic_current:
                    point = SensorCurrentReading(**msg.value)
                    await cache.put_point(point)
                    await manager.broadcast(
                        WSMessage(channel="current",
                                  data=point.model_dump(mode="json")).model_dump()
                    )
                elif msg.topic == settings.topic_alerts:
                    alert = RadiationAlert(**msg.value)
                    await cache.put_alert(alert)
                    await db.insert_alert(alert)
                    await manager.broadcast(
                        WSMessage(channel="alerts",
                                  data=alert.model_dump(mode="json")).model_dump()
                    )
                elif msg.topic == settings.topic_stats:
                    stats = GlobalStats(**msg.value)
                    await cache.put_stats(stats)
                    await manager.broadcast(
                        WSMessage(channel="stats",
                                  data=stats.model_dump(mode="json", exclude_none=True)).model_dump()
                    )
                elif msg.topic == settings.topic_heatmap:
                    cell = HeatmapCell(**msg.value)
                    await cache.put_heat(cell)
                    await manager.broadcast(
                        WSMessage(channel="heatmap",
                                  data=cell.model_dump(mode="json")).model_dump()
                    )
            except Exception:
                logger.exception("Bad Kafka message on %s — skipping", msg.topic)
    except asyncio.CancelledError:
        logger.info("Kafka consumer stopping")
        raise
    finally:
        await consumer.stop()
        