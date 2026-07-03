# app/db.py
import logging

import asyncpg

from .config import settings

logger = logging.getLogger(__name__)

pool: asyncpg.Pool | None = None


async def connect_db() -> None:
    """Open a connection pool to TimescaleDB. Called once at startup."""
    global pool
    pool = await asyncpg.create_pool(dsn=settings.database_url, min_size=2, max_size=10)
    logger.info("Database connected")


async def close_db() -> None:
    """Close the connection pool. Called once at shutdown."""
    global pool
    if pool:
        await pool.close()
        pool = None
        logger.info("Database disconnected")


async def insert_reading(point) -> None:
    """Save one reading permanently to the readings table."""
    #print(f"DEBUG insert_reading called, pool={pool}", flush=True)          #debug DB
    if not pool:
        return
    await pool.execute(
        """
        INSERT INTO readings (captured_at, sensor_key, device_id,
                              location_name, latitude, longitude, cpm, level)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
        point.captured_at_dt,
        point.sensor_key,
        point.device_id,
        point.location_name,
        point.latitude,
        point.longitude,
        point.cpm,
        point.level,
    )


async def insert_alert(alert) -> None:
    """Save one alert permanently to the alerts table."""
    if not pool:
        return
    await pool.execute(
        """
        INSERT INTO alerts (captured_at, sensor_key, location_name,
                            latitude, longitude, cpm, level, alert_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
        alert.captured_at_dt,
        alert.device_id,
        alert.location_name,
        alert.latitude,
        alert.longitude,
        alert.cpm,
        alert.level,
        alert.alert_text,
    )


async def get_sensor_history(sensor_key: str, hours: int = 24) -> list[dict]:
    """All readings for one sensor in the last N hours, oldest first."""
    if not pool:
        return []
    rows = await pool.fetch(
        """
        SELECT captured_at, cpm, level, latitude, longitude, location_name
        FROM readings
        WHERE sensor_key = $1
          AND captured_at > NOW() - MAKE_INTERVAL(hours => $2)
        ORDER BY captured_at ASC
        """,
        sensor_key,
        hours,
    )
    return [dict(row) for row in rows]


async def get_timeseries(days: int = 7, interval: str = "1 hour") -> list[dict]:
    """Average and max cpm grouped by time bucket, for the last N days."""
    if not pool:
        return []
    rows = await pool.fetch(
        f"""
        SELECT
            time_bucket(INTERVAL '{interval}', captured_at) AS bucket,
            AVG(cpm)   AS avg_cpm,
            MAX(cpm)   AS max_cpm,
            COUNT(*)   AS reading_count
        FROM readings
        WHERE captured_at > NOW() - MAKE_INTERVAL(days => $1)
        GROUP BY bucket
        ORDER BY bucket ASC
        """,
        days,
    )
    return [dict(row) for row in rows]


async def get_alert_history(days: int = 30) -> list[dict]:
    """All alerts in the last N days, most recent first."""
    if not pool:
        return []
    rows = await pool.fetch(
        """
        SELECT captured_at, sensor_key, location_name,
               latitude, longitude, cpm, level, alert_text
        FROM alerts
        WHERE captured_at > NOW() - MAKE_INTERVAL(days => $1)
        ORDER BY captured_at DESC
        """,
        days,
    )
    return [dict(row) for row in rows]


async def get_all_sensors() -> list[dict]:
    """Most recent reading per sensor — every sensor ever seen."""
    if not pool:
        return []
    rows = await pool.fetch(
        """
        SELECT DISTINCT ON (sensor_key)
               sensor_key, device_id, location_name,
               latitude, longitude, cpm, level, captured_at
        FROM readings
        ORDER BY sensor_key, captured_at DESC
        """
    )
    return [dict(row) for row in rows]
