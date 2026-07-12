# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="BACKEND_", extra="ignore")

    mock_mode: bool = True
    max_alerts: int = 200
    log_rejected: bool = True

    database_url: str = "postgresql://postgres:password@localhost:5432/radiation"
    redis_url: str = "redis://redis:6379/0"
    sensor_ttl_seconds: int = 3600
    heat_ttl_seconds: int = 300

    kafka_bootstrap: str = "kafka:9092"
    kafka_group: str = "backend"

    topic_clean: str = "radiation-clean"
    topic_current: str = "radiation-current"
    topic_alerts: str = "radiation-alerts"
    topic_stats: str = "radiation-stats"
    topic_heatmap: str = "radiation-heatmap"
    topic_spikes: str = "radiation-spikes"
    topic_top: str = "radiation-top"

    
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
