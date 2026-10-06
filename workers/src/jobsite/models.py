"""The shared shape every connector must produce.

Connectors never touch the database; they only turn an ATS payload into a
NormalizedJob. sync.py owns all writes. That split is what makes connectors
testable against saved fixtures.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class Company:
    id: int
    name: str
    ats: str
    board_token: str
    ats_config: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedJob:
    external_id: str
    title: str
    apply_url: str

    department: str | None = None
    team: str | None = None
    employment_type: str | None = None

    location_raw: str | None = None
    locations: list[str] = field(default_factory=list)
    country: str | None = None
    region: str | None = None
    remote: bool = False
    remote_scope: str | None = None
    # Where a remote job is open to: anywhere | region | country | None.
    open_to: str | None = None

    comp_min: float | None = None
    comp_max: float | None = None
    comp_currency: str | None = None
    comp_period: str | None = None  # year | month | hour
    # Pay read from description_text (pay.py) rather than an ATS field.
    pay_from_text: bool = False

    description_html: str | None = None
    description_text: str | None = None

    # Inferred, not supplied by any ATS. See experience.py.
    exp_min_years: int | None = None
    exp_max_years: int | None = None
    exp_source: str | None = None

    posted_at: datetime | None = None
    ats_updated_at: datetime | None = None

    raw: dict[str, Any] = field(default_factory=dict)

    def content_hash(self) -> str:
        """Fingerprint of the fields we care about, so a sync can skip no-op writes
        and avoid churning the GIN index every run."""
        # Pay read from the text adds nothing the text doesn't already cover,
        # so it stays out: otherwise improving the parser would rewrite every
        # job with pay at once, which a 512 MB database can't absorb.
        comp = (None, None, None, None) if self.pay_from_text else (
            self.comp_min, self.comp_max, self.comp_currency, self.comp_period)
        fields = [
            self.title, self.apply_url, self.department, self.team,
            self.employment_type, self.location_raw, sorted(self.locations),
            self.remote, self.remote_scope, self.open_to,
            comp[0], comp[1],
            comp[2], self.description_text,
            self.exp_min_years, self.exp_max_years,
            self.posted_at.isoformat() if self.posted_at else None,
            self.ats_updated_at.isoformat() if self.ats_updated_at else None,
        ]
        # Only when known, so adding the field didn't change (and rewrite) the
        # fingerprint of every job without pay.
        if comp[3]:
            fields.append(comp[3])
        payload = json.dumps(fields, default=str, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()
