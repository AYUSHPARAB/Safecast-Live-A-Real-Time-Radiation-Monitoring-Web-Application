import logging
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, computed_field, ValidationError

from .config import settings

logger = logging.getLogger(__name__)

Level = Literal["safe", "warning", "elevated", "high"]


class RadiationReading(BaseModel):
    captured_at: int
    uploaded_at: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    cpm: float = Field(ge=0)
    level: Level
    sensor_key: str = Field(min_length=1)
    city: str = ""
    country: str = ""


    @computed_field
    @property
    def captured_at_dt(self) -> datetime:
        return datetime.fromtimestamp(self.captured_at / 1000, tz=timezone.utc)

    @computed_field
    @property
    def display_name(self) -> str:
        if self.city and self.country:
            return f"{self.city}, {self.country}"
        return self.city or self.countrty or f"{self.latitude:.4f}, {self.longitude:.4f}"


class RadiationAlert(RadiationReading):
    """radiation-alerts"""

    @computed_field
    @property
    def alert_text(self) -> str:
        labels = {
            "safe": "safe radiation",
            "warning": "Elevated radiation",
            "elevated": "High radiation",
            "high": "Dangerous radiation",
        }
        return f"{labels.get(self.level,'Radiation')} detected in {self.display_name}"


class SensorCurrentReading(RadiationReading):
    """same as radiation-current and radiation-clean"""
    pass


class RadiationSpike(RadiationReading):
    """radiation-spike"""
    spike_type: str
    previous_cpm: float
    rolling_avg_cpm: float
    jump_ratio: float


    #Aggregates
class GlobalStats(BaseModel):
    avg_cpm: float
    max_cpm: float
    active_sensors: int
    alert_count: int
    reading_count: int | None = None


class HeatmapCell(BaseModel):
    geohash: str
    location: str = ""
    cell_lat: float = Field(ge=-90, le=90)
    cell_lon: float = Field(ge=-180, le=180)
    avg_cpm: float
    max_cpm: float
    count: int
    level: Level

class Hotspot(BaseModel):
    rank: int
    geohash: str
    location: str = ""
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    max_cpm: float
    avg_cpm: float
    level: Level
    count: int


class TopHotspots(BaseModel):
    count: int
    hotspots: list[Hotspot]


#Config+ websocket envelope
class ConfigUpdate(BaseModel):
    threshold: float = Field(gt=0)


class WSMessage(BaseModel):
    channel: Literal["map", "current", "alerts", "stats", "heatmap", "spikes", "top", "config"]
    data: dict
    

def parse_or_log(model_cls, payload, source: str = "", *, log_rejected: bool | None = None):
    """
    Validate `payload` against `model_cls`.
    Returns the parsed model, or None if validation failed.

    On failure it logs the model, source topic, the exact validation errors,
    and the raw payload — but ONLY when logging is enabled.

    Toggle:
      - global: settings.log_rejected  (default True)
      - per-call override: parse_or_log(..., log_rejected=False)
    """
    enabled = settings.log_rejected if log_rejected is None else log_rejected
    try:
        return model_cls.model_validate(payload)
    except ValidationError as exc:
        if enabled:
            logger.warning(
                "REJECTED %s from '%s' — %d validation error(s): %s | payload=%r",
                model_cls.__name__,
                source or "unknown",
                len(exc.errors()),
                exc.errors(),
                payload,
            )
        return None
