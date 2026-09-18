"""Ashby — https://api.ashbyhq.com/posting-api/job-board/{name}

Public, unauthenticated, documented, and the richest of the three: isRemote,
workplaceType, applyUrl and descriptionHtml all arrive in one call, so the
description backfill pass is a no-op here.
"""
from __future__ import annotations

from typing import Any, Iterable

from .. import http
from ..html import clean_description
from ..locations import normalize
from ..models import Company, NormalizedJob
from .base import Connector, ValidationResult, parse_dt, register

BASE = "https://api.ashbyhq.com/posting-api/job-board"


class Ashby(Connector):
    ats = "ashby"
    descriptions_inline = True

    def fetch_listings(self, company: Company, with_content: bool = False
                       ) -> Iterable[dict[str, Any]]:
        data = http.get_json(
            f"{BASE}/{company.board_token}",
            self.ats,
            params={"includeCompensation": "true"},
        )
        if not data:
            return []
        return data.get("jobs", [])

    def normalize(self, company: Company, raw: dict[str, Any]) -> NormalizedJob:
        title = raw.get("title") or ""
        location_raw = raw.get("location")

        # Ashby reports remote directly, but sets isRemote=true on Hybrid roles
        # too — so workplaceType is the authority when present.
        workplace = (raw.get("workplaceType") or "").lower()
        if workplace:
            is_remote = workplace == "remote"
        else:
            is_remote = raw.get("isRemote")

        loc = normalize(location_raw, is_remote, title)
        if workplace == "hybrid":
            loc["remote_scope"] = "hybrid"

        # Secondary locations widen the filterable set.
        for sec in raw.get("secondaryLocations") or []:
            name = sec.get("location") if isinstance(sec, dict) else sec
            if name and name not in loc["locations"]:
                loc["locations"].append(name)

        desc_html, desc_text = clean_description(raw.get("descriptionHtml"))

        comp_min = comp_max = comp_cur = None
        comp = raw.get("compensation") or {}
        summary = comp.get("summaryComponents") or []
        if summary:
            first = summary[0]
            comp_min = first.get("minValue")
            comp_max = first.get("maxValue")
            comp_cur = first.get("currencyCode")

        return NormalizedJob(
            external_id=str(raw.get("id")),
            title=title,
            apply_url=raw.get("applyUrl") or raw.get("jobUrl") or "",
            department=raw.get("department"),
            team=raw.get("team"),
            employment_type=raw.get("employmentType"),
            comp_min=comp_min,
            comp_max=comp_max,
            comp_currency=comp_cur,
            description_html=desc_html,
            description_text=desc_text,
            posted_at=parse_dt(raw.get("publishedAt")),
            ats_updated_at=parse_dt(raw.get("updatedAt") or raw.get("publishedAt")),
            raw=raw,
            **loc,
        )

    def validate_token(self, token: str, config: dict | None = None) -> ValidationResult:
        data = http.get_json(f"{BASE}/{token}", self.ats)
        if data is None:
            return ValidationResult(ok=False, error="404 — no such board")
        jobs = data.get("jobs", [])
        return ValidationResult(
            ok=True,
            job_count=len(jobs),
            sample_titles=[j.get("title") for j in jobs[:3]],
        )

    def board_url(self, company: Company) -> str:
        return f"https://jobs.ashbyhq.com/{company.board_token}"


register(Ashby())
