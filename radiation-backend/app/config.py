# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mock_mode: bool = True
    max_alerts: int = 200
    database_url: str = "postgresql://postgres:password@localhost:5432/radiation"


settings = Settings()

