"""Greenhouse — https://boards-api.greenhouse.io/v1/boards/{token}/jobs

Public, unauthenticated, documented. Unknown tokens return a clean 404, which is
what makes slug probing possible.

Descriptions are NOT in the default listing. `?content=true` adds them to the
same single request: ~12x the payload (stripe 416KB -> 5.1MB) but still one
request instead of ~666. Never fetch Greenhouse descriptions per job.
"""
from __future__ import annotations

import html as htmllib
from typing import Any, Iterable

from .. import http
from ..html import clean_description
from ..locations import normalize
from ..models import Company, NormalizedJob
from .base import Connector, ValidationResult, parse_dt, register

BASE = "https://boards-api.greenhouse.io/v1/boards"


class Greenhouse(Connector):
    ats = "greenhouse"
    descriptions_inline = False  # needs the content=true variant

    def fetch_listings(self, company: Company, with_content: bool = False
                       ) -> Iterable[dict[str, Any]]:
        url = f"{BASE}/{company.board_token}/jobs"
        params = {"content": "true"} if with_content else None
        data = http.get_json(url, self.ats, params=params)
        if not data:
            return []
        return data.get("jobs", [])

    def normalize(self, company: Company, raw: dict[str, Any]) -> NormalizedJob:
        title = raw.get("title") or ""
        location_raw = (raw.get("location") or {}).get("name")

        # content is HTML-escaped inside the JSON, so unescape before sanitizing.
        content = raw.get("content")
        if content:
            content = htmllib.unescape(content)
        desc_html, desc_text = clean_description(content)

        loc = normalize(location_raw, None, title)
        departments = raw.get("departments") or []
        offices = raw.get("offices") or []

        return NormalizedJob(
            external_id=str(raw.get("id")),
            title=title,
            apply_url=raw.get("absolute_url") or "",
            department=(departments[0].get("name") if departments else None),
            team=(offices[0].get("name") if offices else None),
            description_html=desc_html,
            description_text=desc_text,
            posted_at=parse_dt(raw.get("first_published") or raw.get("updated_at")),
            ats_updated_at=parse_dt(raw.get("updated_at")),
            raw=raw,
            **loc,
        )

    def validate_token(self, token: str, config: dict | None = None) -> ValidationResult:
        data = http.get_json(f"{BASE}/{token}/jobs", self.ats)
        if data is None:
            return ValidationResult(ok=False, error="404 — no such board")
        jobs = data.get("jobs", [])
        name = jobs[0].get("company_name") if jobs else None
        return ValidationResult(
            ok=True,
            job_count=(data.get("meta") or {}).get("total") or len(jobs),
            company_name=name,
            sample_titles=[j.get("title") for j in jobs[:3]],
        )

    def board_url(self, company: Company) -> str:
        return f"https://boards.greenhouse.io/{company.board_token}"


register(Greenhouse())
