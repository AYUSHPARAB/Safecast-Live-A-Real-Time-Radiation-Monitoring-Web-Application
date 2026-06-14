from collection import deque
#from typing import Optional
from .config import settings
from .models import SensorCurrentReading, RadiationAlert, GlobalStats

# A cache for storing sensor states, alerts, and global statistics.
class Cache:
    def __init__(self) -> None:
        self.sensor_states: dict[str, SensorCurrentReading] = {}
        self.recent_alerts: deque[RadiationAlert] = deque(maxlen=settings.max_alerts)
        self.latest_global_stats: GlobalStats | None = None

        #Methods to update the cache with new data.
        def put_sensor(self, reading: SensorCurrentReading) -> None:
            # Update the current reading for a sensor.
            self.sensor_states[reading.sensor_key] = reading

        def put_alert(self, alert: RadiationAlert) -> None:
            # Add a new alert to the cache.
            self.recent_alerts.append(alert)

        def put_stats(self, stats: GlobalStats) -> None:
            # Update the latest global statistics.
            self.latest_global_stats = stats


        # Reads from the cache, called by RestAPI endpoints to serve data.
        def get_all_sensors(self) -> list[dict]:
            # Return a list of all current sensor readings in JSON Format.
            return [s.model_dump(mode="json") for s in self.sensor_states.values()]
        
        def get_sensor(self, sensor_key: str) -> SensorCurrentReading | None:
            # Return the latest reading for a sensor, or None is doesnt exist.
            return self.sensor_states.get(sensor_key)

        def get_alerts(self, limit: int = 20) -> list[dict]:
            # Return a list of recent alerts in JSON format, most recent first.
            alerts = list(self.recent_alerts)
            alerts.reverse()  # Show most recent alerts first
            return [a.model_dump(mode="json") for a in alerts[:limit]]
        
        def get_stats(self) -> dict | None:
            # Return the latest  stats in JSON format, or None if unavailable.
            if self.latest_stats:
                return self.latest_stats.model_dump(mode="json")
            return None
        
        def sensor_count(self) -> int:
            # Return the number of sensors currently in the cache.
            return len(self.sensor_states)
        

cache = Cache()