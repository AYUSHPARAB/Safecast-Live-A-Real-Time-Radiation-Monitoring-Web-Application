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
        """Milliseconds -> real UTC datetime. The ÷1000 happens HERE, once."""
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
        """The sentence shown in the Recent Alerts panel."""
        labels = {
            "warning": "Elevated radiation",
            "elevated": "High radiation",
            "high": "Dangerous radiation",
        }
        return f"{labels[self.level]} detected in {self.display_name}"


class SensorCurrentReading(RadiationReading):
    """Topic `radiation-current` — latest reading per sensor.

    Adds `sensor_key`, which is ALWAYS non-empty. Use it as the dict key for
    sensor state — never device_id alone.
    """
    sensor_key: str = Field(min_length=1)   

class GlobalStats(BaseModel):
    """Topic `radiation-stats` — one message every 30s. Drives the stats panel
    and the footer's Total Data Points.
    """
    type: Literal["global_stats"] = "global_stats"
    avg_cpm: float                        
    max_cpm: float                         
    active_sensors: int                     
    alert_count: int                        
    reading_count: int                      


class ConfigUpdate(BaseModel):
    """Topic `radiation-config` —  when the user
    changes the alert threshold in the Settings UI.
    """
    threshold: float = Field(gt=0)          # new alert threshold in CPM


class WSMessage(BaseModel):
    """Envelope wrapping every payload pushed to the browser.

    The frontend routes on `channel`: "map" | "current" | "alerts" | "stats".
    """
    channel: Literal["map", "current", "alerts", "stats"]
    data: dict


