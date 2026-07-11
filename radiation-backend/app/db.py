# app/db.py
import logging
from datetime import datetime, timezone

import asyncpg

from .config import settings

logger = logging.getLogger(__name__)

pool: asyncpg.Pool | None = None

_AUTO_INTERVAL = {
    1:  "5 minutes",
    6:  "30 minutes",
    12: "1 hour",
    24: "2 hours",
}


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


async def insert_reading(reading) -> None:
    """Save one reading permanently to the readings table."""
    if not pool:
        return
    await pool.execute(
        """
        INSERT INTO readings (captured_at, sensor_key, city, country,
                              latitude, longitude, cpm, level)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
        reading.captured_at_dt,
        reading.sensor_key,
        reading.city,
        reading.country,
        reading.latitude,
        reading.longitude,
        reading.cpm,
        reading.level,
    )


async def insert_alert(alert) -> None:
    if not pool:
        return
    await pool.execute(
        """
        INSERT INTO alerts (captured_at, sensor_key, city, country,
                            latitude, longitude, cpm, level, alert_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        alert.captured_at_dt,
        alert.sensor_key,
        alert.city,
        alert.country,
        alert.latitude,
        alert.longitude,
        alert.cpm,
        alert.level,
        alert.alert_text,
    )


async def get_sensor_history(sensor_key: str, hours: int = 24) -> list[dict]:
    if not pool:
        return []
    rows = await pool.fetch(
        """
        SELECT captured_at, ingested_at, cpm, level, latitude, longitude, city, country
        FROM readings
        WHERE sensor_key = $1
          AND ingested_at > NOW() - MAKE_INTERVAL(hours => $2)
        ORDER BY ingested_at ASC
        """,
        sensor_key, hours,
    )
    return [
        {**dict(row), "captured_at": row["captured_at"].isoformat(),
                      "ingested_at": row["ingested_at"].isoformat()}
        for row in rows
    ]


async def get_timeseries(hours: int = 1) -> list[dict]:
    if not pool:
        return []
    interval = _AUTO_INTERVAL.get(hours, "1 hour")  # fallback to 1 hour
    rows = await pool.fetch(
        f"""
        SELECT
            time_bucket(INTERVAL '{interval}', ingested_at) AS bucket,
            AVG(cpm)::float   AS avg_cpm,
            MAX(cpm)::float   AS max_cpm,
            COUNT(*)          AS reading_count
        FROM readings
        WHERE ingested_at > NOW() - MAKE_INTERVAL(hours => $1)
        GROUP BY bucket
        ORDER BY bucket ASC
        """,
        hours,
    )
    return [
        {
            "bucket": row["bucket"].isoformat(),
            "avg_cpm": row["avg_cpm"],
            "max_cpm": row["max_cpm"],
            "reading_count": row["reading_count"],
        }
        for row in rows
    ]

async def get_alert_history(hours: int = 1) -> list[dict]:
    if not pool:
        return []
    rows = await pool.fetch(
        """
        SELECT captured_at, ingested_at, sensor_key, city, country,
               latitude, longitude, cpm, level, alert_text  
        FROM alerts
        WHERE ingested_at > NOW() - MAKE_INTERVAL(hours => $1) 
        ORDER BY ingested_at DESC
        """,
        hours,  
    )
    return [
        {**dict(row), "captured_at": row["captured_at"].isoformat(),
                      "ingested_at": row["ingested_at"].isoformat()}
        for row in rows
    ]


async def get_all_sensors() -> list[dict]:
    """Most recent reading per sensor — every sensor ever seen."""
    if not pool:
        return []
    rows = await pool.fetch(
        """
        SELECT DISTINCT ON (sensor_key)
               sensor_key, city, country,
               latitude, longitude, cpm, level, captured_at, ingested_at
        FROM readings  
        ORDER BY sensor_key, ingested_at DESC
        """
    )
    return [
        {**dict(row), "captured_at": row["captured_at"].isoformat(),
                      "ingested_at": row["ingested_at"].isoformat()} 
        for row in rows
    ]
