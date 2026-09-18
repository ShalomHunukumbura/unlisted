"""Runtime configuration, read from the environment (see .env.example)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://jobsite:jobsite@localhost:5433/jobsite"

    # An honest, contactable UA: someone emails before they block.
    jobsite_user_agent: str = (
        "job-site/0.1 (personal job aggregator; +mailto:technology@bizadvisor.lk)"
    )

    http_timeout: float = 30.0
    # Bound phase-2 work so adding a 5000-job company can't blow up a sync.
    max_detail_fetches_per_run: int = 500


settings = Settings()
