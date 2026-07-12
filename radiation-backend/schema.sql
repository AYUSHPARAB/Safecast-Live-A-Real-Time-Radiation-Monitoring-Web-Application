-- schema.sql
-- Run this once to set up the TimescaleDB tables
-- docker exec -it radiation-db psql -U postgres -d radiation -f schema.sql

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS readings (
    captured_at  TIMESTAMPTZ      NOT NULL,
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sensor_key   TEXT             NOT NULL,
    city         TEXT             DEFAULT '',
    country      TEXT             DEFAULT '',
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    cpm          DOUBLE PRECISION NOT NULL,
    level        TEXT             NOT NULL
);
SELECT create_hypertable('readings', 'captured_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_readings_sensor ON readings (sensor_key, captured_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
    captured_at  TIMESTAMPTZ      NOT NULL,
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sensor_key   TEXT             NOT NULL,
    city         TEXT             DEFAULT '',
    country      TEXT             DEFAULT '',
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    cpm          DOUBLE PRECISION NOT NULL,
    level        TEXT             NOT NULL,
    alert_text   TEXT             DEFAULT ''
);
SELECT create_hypertable('alerts', 'captured_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts (captured_at DESC);
