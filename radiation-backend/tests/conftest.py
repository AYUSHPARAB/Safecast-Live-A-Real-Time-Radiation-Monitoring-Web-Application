# tests/conftest.py
"""
Shared test fixtures — available to every test file automatically.
No imports needed in the test files themselves.
"""
import time
import pytest
from app.models import (
    RadiationReading,
    RadiationAlert,
    SensorCurrentReading,
    GlobalStats,
)


def now_ms():
    """Current time in milliseconds — matching P3's format."""
    return int(time.time() * 1000)


# ── fixtures ──────────────────────────────────────────────────
# A fixture is a function that builds something a test needs.
# The @pytest.fixture decorator makes it available everywhere.

@pytest.fixture
def valid_reading():
    """A real-looking Tokyo reading. Use in any test that needs a reading."""
    return RadiationReading(
        captured_at=now_ms(),
        latitude=35.6895,
        longitude=139.6917,
        cpm=73.6,
        device_id="JP-TKY-0023",
        location_name="Tokyo, Japan",
        md5="a1b2c3d4",
        level="safe",
    )


@pytest.fixture
def valid_alert():
    """A dangerous Fukushima alert."""
    return RadiationAlert(
        captured_at=now_ms(),
        latitude=37.4219,
        longitude=141.0328,
        cpm=312.4,
        device_id="JP-FKS-0089",
        location_name="Fukushima, Japan",
        md5="f7e8d9c0",
        level="high",
    )


@pytest.fixture
def valid_current(valid_reading):
    """A sensor-current reading built from valid_reading."""
    return SensorCurrentReading(
        **valid_reading.model_dump(),
        sensor_key="dev:JP-TKY-0023",
    )


@pytest.fixture
def valid_stats():
    """A global stats snapshot."""
    return GlobalStats(
        avg_cpm=73.6,
        max_cpm=542.7,
        active_sensors=5231,
        alert_count=12,
        reading_count=18392,
    )