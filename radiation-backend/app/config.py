from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BACKEND_")

    mock_mode: bool = True
    max_alerts: int = 50

settings = Settings()