"""Tell Google about new and closed job pages through its Indexing API.

A job is up for a week, and Google takes longer than that to find most pages
in a sitemap on its own. The Indexing API exists for job postings: one request
says "this page is new" (URL_UPDATED) or "this page is gone" (URL_DELETED).

The quota is small (200 requests a day by default), so each run spends what's
left of the day's budget: first on roles that closed after Google was told
about them, then on the newest roles, one per company before a second from any.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

import httpx

from .config import settings
from .db import cursor

log = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/indexing"
PUBLISH = "https://indexing.googleapis.com/v3/urlNotifications:publish"
# No point continuing after these: the key is wrong, the service account isn't
# an owner of the site in Search Console, or the day's quota is spent.
FATAL = {401, 403, 429}


def access_token(key: dict, client: httpx.Client) -> str:
    """Trade the service account's key for a one-hour access token."""
    import jwt  # the indexing extra

    now = int(time.time())
    assertion = jwt.encode(
        {"iss": key["client_email"], "scope": SCOPE, "aud": key["token_uri"], "iat": now, "exp": now + 3600},
        key["private_key"], algorithm="RS256",
    )
    r = client.post(key["token_uri"], data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion})
    r.raise_for_status()
    return r.json()["access_token"]


def budget_left(limit: int) -> int:
    """Requests left today. Counted over the last 24 hours, which can never
    exceed the quota however Google's day is cut."""
    with cursor() as cur:
        cur.execute(
            "SELECT count(*) FILTER (WHERE notified_at > now() - interval '24 hours')"
            "     + count(*) FILTER (WHERE removed_at  > now() - interval '24 hours') AS n FROM index_pings")
        return max(0, limit - cur.fetchone()["n"])


def gone(limit: int) -> list[int]:
    """Roles Google was told about that have since closed or been deleted."""
    with cursor() as cur:
        cur.execute(
            "SELECT p.job_id FROM index_pings p LEFT JOIN jobs j ON j.id = p.job_id "
            " WHERE p.removed_at IS NULL AND (j.id IS NULL OR j.closed_at IS NOT NULL) "
            " ORDER BY p.notified_at LIMIT %s", (limit,))
        return [r["job_id"] for r in cur.fetchall()]


def fresh(limit: int) -> list[int]:
    """Open roles Google hasn't been told about (or was told had closed), the
    same ones the sitemap lists: the newest posting of each role. Every
    company's newest role comes before any company's second."""
    with cursor() as cur:
        cur.execute(
            "WITH roles AS ("
            "  SELECT DISTINCT ON (j.company_id, lower(j.title)) j.id, j.company_id,"
            "         COALESCE(j.posted_at, j.first_seen_at) AS at"
            "    FROM jobs j"
            "   WHERE j.closed_at IS NULL AND COALESCE(j.posted_at, j.first_seen_at) > now() - make_interval(days => %s)"
            "   ORDER BY j.company_id, lower(j.title), j.posted_at DESC NULLS LAST, j.id DESC),"
            " ranked AS (SELECT roles.*, row_number() OVER (PARTITION BY company_id ORDER BY at DESC, id DESC) AS nth FROM roles)"
            " SELECT r.id FROM ranked r"
            "  WHERE NOT EXISTS (SELECT 1 FROM index_pings p WHERE p.job_id = r.id AND p.removed_at IS NULL)"
            "  ORDER BY r.nth, r.at DESC, r.id DESC LIMIT %s", (settings.max_job_age_days, limit))
        return [r["id"] for r in cur.fetchall()]


def record(job_id: int, kind: str) -> None:
    with cursor(commit=True) as cur:
        if kind == "URL_DELETED":
            cur.execute("UPDATE index_pings SET removed_at = now() WHERE job_id = %s", (job_id,))
        else:
            cur.execute(
                "INSERT INTO index_pings (job_id) VALUES (%s) "
                "ON CONFLICT (job_id) DO UPDATE SET notified_at = now(), removed_at = NULL", (job_id,))


def forget_old() -> None:
    with cursor(commit=True) as cur:
        cur.execute("DELETE FROM index_pings WHERE removed_at < now() - interval '30 days'")


@dataclass
class Result:
    announced: int = 0
    removed: int = 0
    failed: int = 0
    stopped: str = ""  # why the run ended early, if it did

    def __str__(self) -> str:
        s = f"told Google about {self.announced} new roles and {self.removed} closed ones"
        if self.failed:
            s += f", {self.failed} failed"
        return s + (f" (stopped: {self.stopped})" if self.stopped else "")


def notify(limit: int | None = None, dry_run: bool = False, client: httpx.Client | None = None,
           token: str | None = None) -> Result:
    """Spend what's left of today's budget. `client` and `token` are for tests."""
    left = budget_left(settings.indexing_daily_limit if limit is None else limit)
    removals = gone(left)
    work = [(i, "URL_DELETED") for i in removals] + [(i, "URL_UPDATED") for i in fresh(left - len(removals))]
    result = Result()
    if dry_run or not work:
        result.removed, result.announced = len(removals), len(work) - len(removals)
        return result

    site = settings.site_url.rstrip("/")
    with client or httpx.Client(timeout=settings.http_timeout) as http:
        token = token or access_token(json.loads(settings.google_indexing_key), http)
        for job_id, kind in work:
            try:
                r = http.post(PUBLISH, json={"url": f"{site}/jobs/{job_id}", "type": kind},
                              headers={"Authorization": f"Bearer {token}"})
            except httpx.HTTPError as exc:
                r = None
                log.warning("%s for job %s: %s", kind, job_id, exc)
            if r is not None and r.status_code == 200:
                record(job_id, kind)
                if kind == "URL_DELETED":
                    result.removed += 1
                else:
                    result.announced += 1
                continue
            result.failed += 1
            if r is not None:
                log.warning("%s for job %s: %s %s", kind, job_id, r.status_code, r.text[:300])
                if r.status_code in FATAL:
                    result.stopped = f"Google answered {r.status_code}"
                    break
            if result.failed >= 5 and not result.announced + result.removed:
                result.stopped = "the first 5 requests failed"
                break
    forget_old()
    return result
