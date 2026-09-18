"""Finding which ATS a company uses, and on what token.

No ATS lets you enumerate its customers and no public company->token dataset
exists, so this is the hard part of the whole project. Two paths:

  probe_name()  bootstrap: guess slugs from a plain company name and ask each
                ATS. Works because Greenhouse/Ashby/Lever 404 cleanly on
                unknown tokens. Measured 42/50 hit rate on a plain name list.
  parse_url()   long tail: pull the ats + token straight out of a careers URL.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from . import connectors
from .db import cursor

log = logging.getLogger(__name__)

PROBE_ORDER = ["greenhouse", "ashby", "lever"]


@dataclass
class Match:
    ats: str
    token: str
    job_count: int
    company_name: str | None = None
    sample_titles: list[str] | None = None
    config: dict | None = None


def slug_variants(name: str) -> list[str]:
    """Candidate board tokens for a plain company name."""
    base = name.strip().lower()
    base = re.sub(r"[''’]", "", base)
    compact = re.sub(r"[^a-z0-9]", "", base)
    hyphen = re.sub(r"[^a-z0-9]+", "-", base).strip("-")

    out = [compact, hyphen]
    # Ashby board names are often capitalized exactly as the company writes them.
    out.append(name.strip().replace(" ", ""))
    for suffix in ("inc", "hq", "labs", "ai"):
        if compact.endswith(suffix) and len(compact) > len(suffix) + 2:
            out.append(compact[: -len(suffix)])
    seen: list[str] = []
    for s in out:
        if s and s not in seen:
            seen.append(s)
    return seen


def _record_probe(ats: str, candidate: str, status: int, job_count: int) -> None:
    with cursor(commit=True) as cur:
        cur.execute(
            """INSERT INTO slug_probes (ats, candidate, status, job_count)
               VALUES (%s,%s,%s,%s)
               ON CONFLICT (ats, candidate) DO UPDATE
                 SET status=EXCLUDED.status, job_count=EXCLUDED.job_count,
                     probed_at=now()""",
            (ats, candidate, status, job_count),
        )


def probe_name(name: str, ats_list: list[str] | None = None,
               use_cache: bool = True) -> Match | None:
    """Probe a company name across ATSs; return the best live board.

    Boards with zero jobs are rejected — stale empty shells are common (vercel
    has an empty Ashby board alongside its real Greenhouse one). Highest job
    count wins.
    """
    candidates = slug_variants(name)
    matches: list[Match] = []

    for ats in (ats_list or PROBE_ORDER):
        conn = connectors.get(ats)
        for cand in candidates:
            if use_cache:
                with cursor() as cur:
                    cur.execute(
                        "SELECT status, job_count FROM slug_probes "
                        "WHERE ats=%s AND candidate=%s",
                        (ats, cand),
                    )
                    row = cur.fetchone()
                if row and row["status"] == 404:
                    continue  # known dead, never re-probe

            try:
                res = conn.validate_token(cand)
            except Exception as exc:  # noqa: BLE001
                log.debug("probe %s/%s failed: %s", ats, cand, exc)
                continue

            _record_probe(ats, cand, 200 if res.ok else 404, res.job_count)
            if res.ok and res.job_count > 0:
                matches.append(Match(ats=ats, token=cand, job_count=res.job_count,
                                     company_name=res.company_name,
                                     sample_titles=res.sample_titles))
                break  # first working token for this ATS is enough

    if not matches:
        return None
    return max(matches, key=lambda m: m.job_count)


# --- URL parsing -------------------------------------------------------------

URL_PATTERNS = [
    ("greenhouse", re.compile(r"(?:job-)?boards(?:\.eu)?\.greenhouse\.io/(?:embed/job_board\?for=)?([\w-]+)")),
    ("greenhouse", re.compile(r"boards-api\.greenhouse\.io/v1/boards/([\w-]+)")),
    ("ashby",      re.compile(r"jobs\.ashbyhq\.com/([\w.-]+)")),
    ("ashby",      re.compile(r"api\.ashbyhq\.com/posting-api/job-board/([\w.-]+)")),
    ("lever",      re.compile(r"jobs(?:\.eu)?\.lever\.co/([\w-]+)")),
    ("lever",      re.compile(r"api(?:\.eu)?\.lever\.co/v0/postings/([\w-]+)")),
]


def parse_url(url: str) -> Match | None:
    """Extract (ats, token) from a careers URL, then validate it live."""
    url = url.strip()
    for ats, pattern in URL_PATTERNS:
        m = pattern.search(url)
        if not m:
            continue
        token = m.group(1)
        config = {"region": "eu"} if ".eu." in url else None
        res = connectors.get(ats).validate_token(token, config)
        if res.ok:
            return Match(ats=ats, token=token, job_count=res.job_count,
                         company_name=res.company_name,
                         sample_titles=res.sample_titles, config=config)
        return None
    return None


def resolve(text: str) -> Match | None:
    """Accept either a careers URL or a bare company name."""
    if urlparse(text).scheme in ("http", "https"):
        return parse_url(text)
    return probe_name(text)


def add_company(match: Match, name: str, source: str = "seed") -> int | None:
    """Insert a discovered company. Returns its id, or None if already present."""
    with cursor(commit=True) as cur:
        cur.execute(
            """INSERT INTO companies (name, ats, board_token, ats_config, source,
                                      discovered_at, verified_at)
               VALUES (%s,%s,%s,%s::jsonb,%s, now(), now())
               ON CONFLICT (ats, board_token) DO NOTHING
               RETURNING id""",
            (match.company_name or name, match.ats, match.token,
             __import__("json").dumps(match.config or {}), source),
        )
        row = cur.fetchone()
        return row["id"] if row else None
