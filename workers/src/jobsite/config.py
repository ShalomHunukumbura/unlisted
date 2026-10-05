"""Runtime configuration, read from the environment (see .env.example)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://jobsite:jobsite@localhost:5433/jobsite"

    # An honest, contactable UA: someone emails before they block.
    jobsite_user_agent: str = (
        "unlisted/0.1 (personal job aggregator; +mailto:benjaminshalom1999@gmail.com)"
    )

    http_timeout: float = 30.0
    # Bound phase-2 work so adding a 5000-job company can't blow up a sync.
    max_detail_fetches_per_run: int = 500
    # Jobs posted longer ago than this are skipped at sync and deleted by prune:
    # by two weeks most roles have hundreds of applicants, so they're noise.
    max_job_age_days: int = 14
    # The full ATS payload, for debugging connectors. Never read by the app, and
    # ~5 KB a job, so the deployment turns it off to fit a free-tier database.
    store_raw: bool = True
    # One sync_runs row per board per run (~5k an hour when hourly, ~280 bytes
    # each). Older rows are pruned so the log can't fill a free-tier database.
    sync_runs_keep_hours: int = 6


settings = Settings()
