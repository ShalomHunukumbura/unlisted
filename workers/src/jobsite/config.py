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
    # within days most roles have hundreds of applicants, so they're noise.
    # 3, down from 14 and then 7: fewer jobs keep the free database small and
    # each run's reads and writes short.
    # The weekly report keeps its own copy of the week's roles (archive.py).
    max_job_age_days: int = 3
    # The full ATS payload, for debugging connectors. Never read by the app, and
    # ~5 KB a job, so the deployment turns it off to fit a free-tier database.
    store_raw: bool = True
    # One sync_runs row per board per run (~5k a run, ~280 bytes
    # each). Older rows are pruned so the log can't fill a free-tier database.
    sync_runs_keep_hours: int = 6

    # `jobsite index-notify`: the site's address, a Google service account key
    # (the JSON file's contents) that owns the site in Search Console, and the
    # Indexing API's daily quota (200 unless Google has raised it).
    site_url: str = "https://findunlisted.link"
    google_indexing_key: str = ""
    indexing_daily_limit: int = 200


settings = Settings()
