"""Lever — https://api.lever.co/v0/postings/{slug}?mode=json

Public, unauthenticated, documented. Descriptions arrive inline, so the backfill
pass is a no-op. EU tenants live on api.eu.lever.co, selected via
ats_config={"region": "eu"}.

Note: the listing returns a bare JSON *array*, not an object.
"""
from __future__ import annotations

from typing import Any, Iterable

from .. import http
from ..html import clean_description
from ..locations import normalize
from ..models import Company, NormalizedJob
from .base import Connector, ValidationResult, parse_dt, register


def _base(config: dict | None) -> str:
    region = (config or {}).get("region")
    host = "api.eu.lever.co" if region == "eu" else "api.lever.co"
    return f"https://{host}/v0/postings"


class Lever(Connector):
    ats = "lever"
    descriptions_inline = True

    def fetch_listings(self, company: Company, with_content: bool = False
                       ) -> Iterable[dict[str, Any]]:
        url = f"{_base(company.ats_config)}/{company.board_token}"
        data = http.get_json(url, self.ats, params={"mode": "json"})
        if not data or not isinstance(data, list):
            return []
        return data

    def normalize(self, company: Company, raw: dict[str, Any]) -> NormalizedJob:
        title = raw.get("text") or ""
        categories = raw.get("categories") or {}
        location_raw = categories.get("location")

        workplace = (raw.get("workplaceType") or "").lower()
        is_remote = True if workplace == "remote" else (False if workplace == "onsite" else None)

        loc = normalize(location_raw, is_remote, title)
        if workplace == "hybrid":
            loc["remote_scope"] = "hybrid"

        # Lever splits the body across description + a list of sections.
        parts = [raw.get("description") or ""]
        for item in raw.get("lists") or []:
            if item.get("text"):
                parts.append(f"<h3>{item['text']}</h3>")
            if item.get("content"):
                parts.append(f"<ul>{item['content']}</ul>")
        if raw.get("additional"):
            parts.append(raw["additional"])
        desc_html, desc_text = clean_description("".join(p for p in parts if p))

        return NormalizedJob(
            external_id=str(raw.get("id")),
            title=title,
            apply_url=raw.get("applyUrl") or raw.get("hostedUrl") or "",
            department=categories.get("department") or categories.get("team"),
            team=categories.get("team"),
            employment_type=categories.get("commitment"),
            description_html=desc_html,
            description_text=desc_text,
            posted_at=parse_dt(raw.get("createdAt")),
            ats_updated_at=parse_dt(raw.get("updatedAt") or raw.get("createdAt")),
            raw=raw,
            **loc,
        )

    def validate_token(self, token: str, config: dict | None = None) -> ValidationResult:
        data = http.get_json(f"{_base(config)}/{token}", self.ats, params={"mode": "json"})
        if data is None:
            return ValidationResult(ok=False, error="404 — no such board")
        if not isinstance(data, list):
            return ValidationResult(ok=False, error="unexpected payload shape")
        return ValidationResult(
            ok=True,
            job_count=len(data),
            sample_titles=[j.get("text") for j in data[:3]],
        )

    def board_url(self, company: Company) -> str:
        return f"https://jobs.lever.co/{company.board_token}"


register(Lever())
