"""
Tests for app/models.py

We test two things for every model:
  1. Valid data parses successfully (the happy path)
  2. Invalid data raises ValidationError (the rejection path)

No Kafka, no database, no server needed — just Python objects.
"""
import pytest
from pydantic import ValidationError
from app.models import (
    RadiationReading,
    RadiationAlert,
    SensorCurrentReading,
    GlobalStats,
    ConfigUpdate,
    WSMessage,
)


# ─────────────────────────────────────────────
# MOCK DATA
# These are copy-pasted from the real contract
# (docs/p3_p4_contract.md) — the exact JSON
# P3's Flink job actually sends.
# ─────────────────────────────────────────────

# A normal safe reading from Tokyo
VALID_READING = {
    "captured_at":   1746700245000,
    "uploaded_at":   "2026-05-08 12:31:00",
    "latitude":      35.6895,
    "longitude":     139.6917,
    "cpm":           73.6,
    "unit":          "cpm",
    "device_id":     "JP-TKY-0023",
    "location_name": "Tokyo, Japan",
    "md5":           "a1b2c3d4e5f6",
    "level":         "safe",
}

# A dangerous reading from Fukushima
VALID_ALERT = {
    "captured_at":   1746699880000,
    "uploaded_at":   "2026-05-08 12:28:00",
    "latitude":      37.4219,
    "longitude":     141.0328,
    "cpm":           312.4,
    "unit":          "cpm",
    "device_id":     "JP-FKS-0089",
    "location_name": "Fukushima, Japan",
    "md5":           "f7e8d9c0b1a2",
    "level":         "high",
}

# A current-sensor reading (same as reading + sensor_key)
VALID_CURRENT = {
    **VALID_READING,                        # everything from the reading...
    "sensor_key": "dev:JP-TKY-0023",        # ...plus this one extra field
}

# The global stats snapshot (completely different shape)
VALID_STATS = {
    "type":           "global_stats",
    "avg_cpm":        73.6,
    "max_cpm":        542.7,
    "active_sensors": 5231,
    "alert_count":    12,
    "reading_count":  18392,
}


# ─────────────────────────────────────────────
# RadiationReading tests
# ─────────────────────────────────────────────

class TestRadiationReading:

    def test_valid_reading_parses(self):
        """The real contract example should parse without any error."""
        reading = RadiationReading(**VALID_READING)
        assert reading.cpm == 73.6
        assert reading.level == "safe"
        assert reading.device_id == "JP-TKY-0023"

    def test_captured_at_dt_converts_milliseconds(self):
        """The milliseconds timestamp must become a real year-2026 datetime.
        If this returns year ~52000, the /1000 division is missing."""
        reading = RadiationReading(**VALID_READING)
        dt = reading.captured_at_dt
        assert dt.year == 2025
        assert dt.tzinfo is not None     # must be timezone-aware (UTC)

    def test_display_name_uses_location_name(self):
        """When location_name is present, use it."""
        reading = RadiationReading(**VALID_READING)
        assert reading.display_name == "Tokyo, Japan"

    def test_display_name_falls_back_to_coordinates(self):
        """When location_name is empty, fall back to lat/lon string."""
        data = {**VALID_READING, "location_name": ""}
        reading = RadiationReading(**data)
        assert reading.display_name == "35.6895, 139.6917"

    def test_uploaded_at_can_be_none(self):
        """uploaded_at is optional — missing it is fine."""
        data = {**VALID_READING}
        del data["uploaded_at"]
        reading = RadiationReading(**data)
        assert reading.uploaded_at is None

    def test_device_id_can_be_empty_string(self):
        """device_id may arrive as empty string — accept it."""
        data = {**VALID_READING, "device_id": ""}
        reading = RadiationReading(**data)
        assert reading.device_id == ""

    # ── rejection tests ───────────────────────

    def test_rejects_missing_level(self):
        """level is required — no default, must be present."""
        data = {**VALID_READING}
        del data["level"]
        with pytest.raises(ValidationError) as exc:
            RadiationReading(**data)
        assert "level" in str(exc.value)

    def test_rejects_invalid_level(self):
        """level must be one of the four allowed words."""
        data = {**VALID_READING, "level": "medium"}
        with pytest.raises(ValidationError):
            RadiationReading(**data)

    def test_rejects_latitude_out_of_range(self):
        """Latitude must be between -90 and 90."""
        data = {**VALID_READING, "latitude": 200.0}
        with pytest.raises(ValidationError):
            RadiationReading(**data)

    def test_rejects_negative_longitude(self):
        """Longitude must be between -180 and 180."""
        data = {**VALID_READING, "longitude": -999.0}
        with pytest.raises(ValidationError):
            RadiationReading(**data)

    def test_rejects_zero_cpm(self):
        """cpm must be greater than 0 (gt=0 means strictly above zero)."""
        data = {**VALID_READING, "cpm": 0.0}
        with pytest.raises(ValidationError):
            RadiationReading(**data)

    def test_rejects_negative_cpm(self):
        """Negative radiation makes no sense."""
        data = {**VALID_READING, "cpm": -10.0}
        with pytest.raises(ValidationError):
            RadiationReading(**data)

    def test_rejects_cpm_above_limit(self):
        """cpm must be below 10,000 (Flink filters these out, but we double-check)."""
        data = {**VALID_READING, "cpm": 99999.0}
        with pytest.raises(ValidationError):
            RadiationReading(**data)

    def test_rejects_text_as_latitude(self):
        """latitude must be a number, not text."""
        data = {**VALID_READING, "latitude": "hello"}
        with pytest.raises(ValidationError):
            RadiationReading(**data)

    def test_rejects_missing_captured_at(self):
        """captured_at is required — the whole time system depends on it."""
        data = {**VALID_READING}
        del data["captured_at"]
        with pytest.raises(ValidationError):
            RadiationReading(**data)


# ─────────────────────────────────────────────
# RadiationAlert tests
# ─────────────────────────────────────────────

class TestRadiationAlert:

    def test_valid_alert_parses(self):
        alert = RadiationAlert(**VALID_ALERT)
        assert alert.cpm == 312.4
        assert alert.level == "high"

    def test_alert_text_high(self):
        """High level should produce 'Dangerous radiation detected in ...'"""
        alert = RadiationAlert(**VALID_ALERT)
        assert alert.alert_text == "Dangerous radiation detected in Fukushima, Japan"

    def test_alert_text_warning(self):
        """Warning level should produce 'Elevated radiation detected in ...'"""
        data = {**VALID_ALERT, "level": "warning"}
        alert = RadiationAlert(**data)
        assert alert.alert_text == "Elevated radiation detected in Fukushima, Japan"

    def test_alert_text_elevated(self):
        data = {**VALID_ALERT, "level": "elevated"}
        alert = RadiationAlert(**data)
        assert alert.alert_text == "High radiation detected in Fukushima, Japan"

    def test_alert_text_uses_coordinate_fallback(self):
        """When location_name is empty, alert_text uses coordinates."""
        data = {**VALID_ALERT, "location_name": ""}
        alert = RadiationAlert(**data)
        assert "37.4219" in alert.alert_text
        assert "141.0328" in alert.alert_text

    def test_inherits_captured_at_dt(self):
        """RadiationAlert inherits captured_at_dt from RadiationReading."""
        alert = RadiationAlert(**VALID_ALERT)
        assert alert.captured_at_dt.year == 2025

    # ── rejection tests ───────────────────────

    def test_rejects_safe_level(self):
        """An alert with level='safe' is a contradiction — reject it."""
        data = {**VALID_ALERT, "level": "safe"}
        with pytest.raises(ValidationError):
            RadiationAlert(**data)

    def test_rejects_missing_level(self):
        data = {**VALID_ALERT}
        del data["level"]
        with pytest.raises(ValidationError):
            RadiationAlert(**data)


# ─────────────────────────────────────────────
# SensorCurrentReading tests
# ─────────────────────────────────────────────

class TestSensorCurrentReading:

    def test_valid_current_reading_parses(self):
        current = SensorCurrentReading(**VALID_CURRENT)
        assert current.sensor_key == "dev:JP-TKY-0023"
        assert current.cpm == 73.6

    def test_geo_format_sensor_key(self):
        """sensor_key can also be in 'geo:lat,lon' format."""
        data = {**VALID_CURRENT, "device_id": "", "sensor_key": "geo:35.6895,139.6917"}
        current = SensorCurrentReading(**data)
        assert current.sensor_key == "geo:35.6895,139.6917"

    def test_inherits_display_name(self):
        """Inherits all computed properties from RadiationReading."""
        current = SensorCurrentReading(**VALID_CURRENT)
        assert current.display_name == "Tokyo, Japan"

    # ── rejection tests ───────────────────────

    def test_rejects_empty_sensor_key(self):
        """sensor_key must never be empty — that's the whole point of it."""
        data = {**VALID_CURRENT, "sensor_key": ""}
        with pytest.raises(ValidationError):
            SensorCurrentReading(**data)

    def test_rejects_missing_sensor_key(self):
        """sensor_key is required — no default."""
        data = {**VALID_CURRENT}
        del data["sensor_key"]
        with pytest.raises(ValidationError):
            SensorCurrentReading(**data)


# ─────────────────────────────────────────────
# GlobalStats tests
# ─────────────────────────────────────────────

class TestGlobalStats:

    def test_valid_stats_parse(self):
        stats = GlobalStats(**VALID_STATS)
        assert stats.avg_cpm == 73.6
        assert stats.active_sensors == 5231
        assert stats.reading_count == 18392

    def test_type_defaults_to_global_stats(self):
        """type field has a default — you don't need to provide it."""
        data = {k: v for k, v in VALID_STATS.items() if k != "type"}
        stats = GlobalStats(**data)
        assert stats.type == "global_stats"

    # ── rejection tests ───────────────────────

    def test_rejects_missing_avg_cpm(self):
        data = {**VALID_STATS}
        del data["avg_cpm"]
        with pytest.raises(ValidationError):
            GlobalStats(**data)

    def test_rejects_text_as_active_sensors(self):
        """active_sensors must be an integer, not text."""
        data = {**VALID_STATS, "active_sensors": "many"}
        with pytest.raises(ValidationError):
            GlobalStats(**data)


# ─────────────────────────────────────────────
# ConfigUpdate tests
# ─────────────────────────────────────────────

class TestConfigUpdate:

    def test_valid_threshold(self):
        config = ConfigUpdate(threshold=200.0)
        assert config.threshold == 200.0

    def test_fractional_threshold(self):
        """Thresholds can be fractional CPM values."""
        config = ConfigUpdate(threshold=150.5)
        assert config.threshold == 150.5

    def test_rejects_zero_threshold(self):
        """gt=0 means STRICTLY greater than zero. Zero itself is rejected."""
        with pytest.raises(ValidationError):
            ConfigUpdate(threshold=0.0)

    def test_rejects_negative_threshold(self):
        with pytest.raises(ValidationError):
            ConfigUpdate(threshold=-50.0)

    def test_rejects_missing_threshold(self):
        with pytest.raises(ValidationError):
            ConfigUpdate()


# ─────────────────────────────────────────────
# WSMessage tests
# ─────────────────────────────────────────────

class TestWSMessage:

    def test_valid_stats_envelope(self):
        msg = WSMessage(channel="stats", data=VALID_STATS)
        assert msg.channel == "stats"
        assert msg.data["avg_cpm"] == 73.6

    def test_valid_alerts_envelope(self):
        msg = WSMessage(channel="alerts", data=VALID_ALERT)
        assert msg.channel == "alerts"

    def test_all_channels_accepted(self):
        """Every allowed channel should parse."""
        for channel in ["map", "current", "alerts", "stats"]:
            msg = WSMessage(channel=channel, data={})
            assert msg.channel == channel

    def test_rejects_unknown_channel(self):
        """Channel must be one of the four — no free text."""
        with pytest.raises(ValidationError):
            WSMessage(channel="dashboard", data={})

    def test_rejects_missing_channel(self):
        with pytest.raises(ValidationError):
            WSMessage(data={})

    def test_serialises_to_json(self):
        """model_dump_json() is how you send this over WebSocket."""
        msg = WSMessage(channel="stats", data={"avg_cpm": 73.6})
        json_str = msg.model_dump_json()
        assert '"channel":"stats"' in json_str
        assert '"avg_cpm"' in json_str

