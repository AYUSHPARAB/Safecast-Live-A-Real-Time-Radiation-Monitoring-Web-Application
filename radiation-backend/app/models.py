from datetime import datetime
from pydantic import BaseModel, Field

class SensorPoint(BaseModel):
    sensor_id: str
    lat: float = Field(ge =-90, le =90)
    lon: float = Field(ge =-180, le =180)
    cpm: float = Field(ge=0)
    sensor_type: str = "unknown"
    event_time: datetime

class Alert(BaseModel):
    alert_id: str
    sensor_id: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    cpm: float = Field(ge=0)
    threshold: float = Field(ge=0)
    severity: str = "high"
    region: str | None = None
    message: str | None = None
    event_time: datetime


class StatsSnapshot(BaseModel):
    window_start: datetime
    window_end: datetime
    avg_cpm: float
    max_cpm: float
    active_sensors: int
    alert_count: int
    event_time: datetime


class ThresholdConfig(BaseModel):
    value: float = Field(ge=0)

    