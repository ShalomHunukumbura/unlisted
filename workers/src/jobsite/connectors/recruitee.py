"""Recruitee — https://{slug}.recruitee.com/api/offers/

Public, unauthenticated: the careers-site API every Recruitee board serves.
Unknown slugs return a clean 404, so slug probing works. Descriptions arrive
inline, so the backfill pass is a no-op.

Mostly European employers, so postings are often in the local language. Where
the employer added an English translation it's preferred; otherwise the
posting stays as written.
"""
from __future__ import annotations

from typing import Any, Iterable

from .. import http
from ..html import clean_description
from ..locations import PLACES, normalize
from ..models import Company, NormalizedJob
from .base import Connector, ValidationResult, parse_dt, register

PERIODS = {"year": "year", "month": "month", "hour": "hour"}

# ISO country code -> region, for the codes locations.py knows.
REGIONS = {country: region for country, region in PLACES.values() if country}

# employment_type_code -> the wording the job page and its schema.org data use.
EMPLOYMENT = {"fulltime": "Full-time", "parttime": "Part-time", "internship": "Internship",
              "freelance": "Contract", "temporary": "Temporary"}


def _base(token: str) -> str:
    return f"https://{token}.recruitee.com/api/offers/"


def _number(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


class Recruitee(Connector):
    ats = "recruitee"
    descriptions_inline = True

    def fetch_listings(self, company: Company, with_content: bool = False
                       ) -> Iterable[dict[str, Any]]:
        data = http.get_json(_base(company.board_token), self.ats)
        if not data:
            return []
        return data.get("offers", [])

    def normalize(self, company: Company, raw: dict[str, Any]) -> NormalizedJob:
        en = (raw.get("translations") or {}).get("en") or {}
        title = en.get("title") or raw.get("title") or ""

        # `location` is in the board's language ("Nederland"); the structured
        # list usually has English country names, and always a country code.
        places = []
        for loc in raw.get("locations") or []:
            place = ", ".join(p for p in (loc.get("city"), loc.get("country")) if p)
            if place and place not in places:
                places.append(place)
        location_raw = "; ".join(places) or raw.get("location") or None

        # Three flags, any combination; remote only when it's the sole option.
        hybrid = bool(raw.get("hybrid"))
        is_remote = bool(raw.get("remote")) and not hybrid and not raw.get("on_site")
        if raw.get("remote") and not places:
            location_raw = "Remote"
        loc = normalize(location_raw, is_remote, title)
        codes = [l.get("country_code") for l in raw.get("locations") or [] if l.get("country_code")]
        if loc["country"] is None and codes:
            # Some boards localize the country name too ("Goslar, Deutschland").
            loc["country"] = codes[0].upper()
            loc["region"] = loc["region"] or REGIONS.get(loc["country"])
            if loc["remote_scope"] in ("global", "region"):
                loc["remote_scope"] = "country"
        if hybrid:
            loc["remote_scope"] = "hybrid"

        parts = [en.get("description") or raw.get("description") or ""]
        requirements = en.get("requirements") or raw.get("requirements")
        if requirements:
            parts.append(requirements)
        desc_html, desc_text = clean_description("".join(parts))

        salary = raw.get("salary") or {}
        comp_min, comp_max = _number(salary.get("min")), _number(salary.get("max"))
        period = PERIODS.get(salary.get("period") or "")
        if not (period and (comp_min or comp_max)):
            comp_min = comp_max = period = None
            salary = {}

        code = raw.get("employment_type_code") or ""
        employment = next((label for key, label in EMPLOYMENT.items() if code.startswith(key)), None)

        return NormalizedJob(
            external_id=str(raw.get("id")),
            title=title,
            apply_url=raw.get("careers_url") or raw.get("careers_apply_url") or "",
            department=raw.get("department"),
            employment_type=employment,
            comp_min=comp_min or comp_max,
            comp_max=comp_max or comp_min,
            comp_currency=salary.get("currency"),
            comp_period=period,
            description_html=desc_html,
            description_text=desc_text,
            posted_at=parse_dt(raw.get("published_at") or raw.get("created_at")),
            ats_updated_at=parse_dt(raw.get("updated_at") or raw.get("published_at")),
            raw=raw,
            **loc,
        )

    def validate_token(self, token: str, config: dict | None = None) -> ValidationResult:
        data = http.get_json(_base(token), self.ats)
        if data is None:
            return ValidationResult(ok=False, error="404 — no such board")
        if not isinstance(data, dict):
            return ValidationResult(ok=False, error="unexpected payload shape")
        offers = data.get("offers") or []
        return ValidationResult(
            ok=True,
            job_count=len(offers),
            company_name=offers[0].get("company_name") if offers else None,
            sample_titles=[o.get("title") for o in offers[:3]],
        )

    def board_url(self, company: Company) -> str:
        return f"https://{company.board_token}.recruitee.com"


register(Recruitee())
