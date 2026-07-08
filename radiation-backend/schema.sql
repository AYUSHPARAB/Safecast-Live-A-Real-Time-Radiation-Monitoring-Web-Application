-- schema.sql
-- Run this once to set up the TimescaleDB tables
-- docker exec -it radiation-db psql -U postgres -d radiation -f schema.sql

CREATE TABLE IF NOT EXISTS readings (
    captured_at   TIMESTAMPTZ NOT NULL,
    sensor_key    TEXT NOT NULL,
    device_id     TEXT,
    location_name TEXT,
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    cpm           DOUBLE PRECISION,
    level         TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
    captured_at   TIMESTAMPTZ NOT NULL,
    sensor_key    TEXT NOT NULL,
    location_name TEXT,
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    cpm           DOUBLE PRECISION,
    level         TEXT,
    alert_text    TEXT
);

SELECT create_hypertable('readings', 'captured_at', if_not_exists => TRUE);
SELECT create_hypertable('alerts', 'captured_at', if_not_exists => TRUE);