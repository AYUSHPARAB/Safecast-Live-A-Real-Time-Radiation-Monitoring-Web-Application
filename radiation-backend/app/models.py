from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, computed_field


Level = Literal["safe", "warning", "elevated", "high"]


class RadiationReading(BaseModel):
    captured_at: int
    uploaded_at: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    cpm: float = Field(gt=0, lt=10_000)
    unit: str = "cpm"
    device_id: str = ""
    location_name: str = ""
    md5: str = ""
    level: Level

    @computed_field
    @property
    def captured_at_dt(self) -> datetime:
        return datetime.fromtimestamp(self.captured_at / 1000, tz=timezone.utc)

    @computed_field
    @property
    def display_name(self) -> str:
        return self.location_name or f"{self.latitude:.4f}, {self.longitude:.4f}"


class RadiationAlert(RadiationReading):
    level: Literal["warning", "elevated", "high"]

    @computed_field
    @property
    def alert_text(self) -> str:
        labels = {
            "warning": "Elevated radiation",
            "elevated": "High radiation",
            "high": "Dangerous radiation",
        }
        return f"{labels[self.level]} detected in {self.display_name}"


class SensorCurrentReading(RadiationReading):

    sensor_key: str = Field(min_length=1)


class GlobalStats(BaseModel):

    type: Literal["global_stats"] = "global_stats"
    avg_cpm: float
    max_cpm: float
    active_sensors: int
    alert_count: int
    reading_count: int | None = None


class HeatmapCell(BaseModel):

    type: Literal["heatmap_cell"] = "heatmap_cell"
    geohash: str
    cell_lat: float = Field(ge=-90, le=90)
    cell_lon: float = Field(ge=-180, le=180)
    avg_cpm: float
    max_cpm: float
    count: int
    level: Level


class ConfigUpdate(BaseModel):
    threshold: float = Field(gt=0)


class WSMessage(BaseModel):
 
    channel: Literal["map", "current", "alerts", "stats", "heatmap"]
    data: dict