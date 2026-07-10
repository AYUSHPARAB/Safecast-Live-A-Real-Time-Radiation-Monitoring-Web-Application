import json
from typing import Optional

import redis.asyncio as redis

from .config import settings
from .models import SensorCurrentReading, RadiationAlert, GlobalStats, HeatmapCell, RadiationSpike, TopHotspots

SENSOR_PREFIX = "sensor:"
HEAT_PREFIX = "heat:"
ALERTS_KEY = "alerts"
STATS_KEY = "stats:current"
CONFIG_KEY = "config:threshold"
SPIKES_KEY = "spikes"
TOP_KEY = "top:current"


class Cache:
    def __init__(self) -> None:
        self.r: redis.Redis = redis.from_url(settings.redis_url, decode_responses=True)

    async def ping(self) -> bool:
        return await self.r.ping()

    async def close(self) -> None:
        await self.r.aclose()

    async def put_point(self, reading: SensorCurrentReading) -> None:
        await self.r.set(
            SENSOR_PREFIX + reading.sensor_key,
            json.dumps(reading.model_dump(mode="json")),
            ex=settings.sensor_ttl_seconds,
        )

    async def put_alert(self, alert: RadiationAlert) -> None:
        await self.r.lpush(ALERTS_KEY, json.dumps(alert.model_dump(mode="json")))
        await self.r.ltrim(ALERTS_KEY, 0, settings.max_alerts - 1)

    async def put_stats(self, stats: GlobalStats) -> None:
        await self.r.set(STATS_KEY, json.dumps(stats.model_dump(mode="json", exclude_none=True)))

    async def put_heat(self, cell: HeatmapCell) -> None:
        await self.r.set(
            HEAT_PREFIX + cell.geohash,
            json.dumps(cell.model_dump(mode="json")),
            ex=settings.sensor_ttl_seconds,
        )

    async def get_all_sensors(self) -> list[dict]:
        keys = [k async for k in self.r.scan_iter(match=SENSOR_PREFIX + "*")]
        if not keys:
            return []
        values = await self.r.mget(keys)
        return [json.loads(v) for v in values if v is not None]

    async def get_sensor(self, sensor_key: str) -> Optional[dict]:
        v = await self.r.get(SENSOR_PREFIX + sensor_key)
        return json.loads(v) if v is not None else None

    async def get_alerts(self, limit: int = 20) -> list[dict]:
        values = await self.r.lrange(ALERTS_KEY, 0, limit - 1)   
        return [json.loads(v) for v in values]

    async def get_stats(self) -> Optional[dict]:
        v = await self.r.get(STATS_KEY)
        return json.loads(v) if v is not None else None

    async def get_all_heat(self) -> list[dict]:
        keys = [k async for k in self.r.scan_iter(match=HEAT_PREFIX + "*")]
        if not keys:
            return []
        values = await self.r.mget(keys)
        return [json.loads(v) for v in values if v is not None]

    async def sensor_count(self) -> int:
        count = 0
        async for _ in self.r.scan_iter(match=SENSOR_PREFIX + "*"):
            count += 1
        return count
    async def put_threshold(self, threshold: float) -> None:
        await self.r.set(CONFIG_KEY, threshold)
    async def get_threshold(self) -> float | None:
        v = await self.r.get(CONFIG_KEY)
        return float(v) if v is not None else None
    async def put_spike(self, spike: RadiationSpike) -> None:
        await self.r.

cache = Cache()
