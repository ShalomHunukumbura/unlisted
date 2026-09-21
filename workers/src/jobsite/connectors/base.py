"""Connector contract + registry.

Connectors turn an ATS payload into NormalizedJob objects and nothing else.
They never touch the database — sync.py owns all writes.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, ClassVar, Iterable

from ..experience import infer as infer_experience
from ..remote_scope import classify as classify_open_to
from ..models import Company, NormalizedJob


@dataclass
class ValidationResult:
    ok: bool
    job_count: int = 0
    company_name: str | None = None
    sample_titles: list[str] | None = None
    error: str | None = None


class Connector(ABC):
    ats: ClassVar[str]

    #: True when the listing response already carries descriptions, so the
    #: description backfill pass is a no-op for this ATS.
    descriptions_inline: ClassVar[bool] = False

    @abstractmethod
    def fetch_listings(self, company: Company, with_content: bool = False
                       ) -> Iterable[dict[str, Any]]:
        """Yield raw job dicts for a company's board."""

    @abstractmethod
    def normalize(self, company: Company, raw: dict[str, Any]) -> NormalizedJob:
        """Map one raw job onto the shared shape."""

    def normalize_job(self, company: Company, raw: dict[str, Any]) -> NormalizedJob:
        """normalize() plus the enrichment every connector should get.

        Applied here rather than in each connector so a new ATS cannot silently
        skip it.
        """
        job = self.normalize(company, raw)
        if job.exp_min_years is None and job.exp_source is None:
            for key, value in infer_experience(job.title, job.description_text).items():
                setattr(job, key, value)
        if job.open_to is None:
            job.open_to = classify_open_to(
                job.location_raw, job.remote, job.country, job.region
            )
        return job

    @abstractmethod
    def validate_token(self, token: str, config: dict | None = None) -> ValidationResult:
        """Check a board token is real, for slug probing and the admin add flow."""

    def board_url(self, company: Company) -> str | None:
        return None


_REGISTRY: dict[str, Connector] = {}


def register(conn: Connector) -> Connector:
    _REGISTRY[conn.ats] = conn
    return conn


def get(ats: str) -> Connector:
    if ats not in _REGISTRY:
        raise KeyError(f"no connector registered for {ats!r}")
    return _REGISTRY[ats]


def available() -> list[str]:
    return sorted(_REGISTRY)


def parse_dt(value: Any) -> datetime | None:
    """Parse the assorted timestamp formats these APIs emit."""
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):           # Ashby/Lever epoch millis
        seconds = value / 1000 if value > 1e11 else value
        return datetime.fromtimestamp(seconds, tz=timezone.utc)
    if isinstance(value, str):
        text = value.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return None
