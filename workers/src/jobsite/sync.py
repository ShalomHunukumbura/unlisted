"""Sync orchestration, in two phases so the database is busy for minutes, not the hour:

1. Fetch: every board is downloaded and normalized with no database connection
   open. This is most of a run (the ATS rate limits set its length).
2. Write: one short burst per run upserts changed jobs, marks unchanged ones as
   seen in bulk, closes jobs that disappeared, records the run, and prunes.

That matters on a serverless Postgres (Neon) that bills compute time: a run that
wrote as it went kept the database awake for the whole ~26 minutes.

A job that stops appearing in a company's board is stamped closed_at; if it
comes back, the upsert reopens it. Jobs older than settings.max_job_age_days
(by posted_at, or first_seen_at when the ATS gives no date) are never stored:
sync skips them and prune() deletes any that have aged out since.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from . import connectors, pay
from .config import settings
from .db import close_pool, cursor
from .html import to_text
from .models import Company, NormalizedJob

log = logging.getLogger(__name__)

# If a board returns nothing but we already hold more than this many open jobs,
# treat it as a suspicious response and refuse to close them. Without this, one
# bad upstream response silently wipes a company's entire board.
SUSPICIOUS_EMPTY_THRESHOLD = 5

# Tiered schedule for `sync --due`: boards with open jobs are checked every run
# (hourly), boards with none every few hours. About 40% of boards have nothing
# from the past week, so this cuts requests without missing much.
ACTIVE_EVERY = timedelta(minutes=50)   # under an hour, so hourly runs don't skip
QUIET_EVERY = timedelta(hours=6) - timedelta(minutes=10)


def age_cutoff(now: datetime | None = None) -> datetime:
    """Anything posted before this is too old to keep."""
    return (now or datetime.now(timezone.utc)) - timedelta(days=settings.max_job_age_days)


def is_too_old(job: NormalizedJob, cutoff: datetime) -> bool:
    # No posted date: keep it; prune ages it out by first_seen_at instead.
    return job.posted_at is not None and job.posted_at < cutoff


def prune(cutoff: datetime | None = None, company_id: int | None = None) -> int:
    """Delete jobs older than the cutoff (for one company, or all). Returns how many.

    Also drops sync logs older than settings.sync_runs_keep_hours.
    """
    with cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM jobs WHERE COALESCE(posted_at, first_seen_at) < %s "
            "AND (%s::bigint IS NULL OR company_id = %s)",
            (cutoff or age_cutoff(), company_id, company_id),
        )
        pruned = cur.rowcount
        cur.execute(
            "DELETE FROM sync_runs WHERE started_at < now() - make_interval(hours => %s) "
            "AND (%s::bigint IS NULL OR company_id = %s)",
            (settings.sync_runs_keep_hours, company_id, company_id),
        )
        return pruned



def backfill_pay(batch: int = 1000, on_batch=None, company_id: int | None = None) -> int:
    """Fill pay ranges for jobs stored before pay.py existed. Returns rows changed.

    Text-derived pay is left out of content_hash, so the sync never rewrites a
    job just to add it; this does it once instead. Every UPDATE writes a new
    row version (and recomputes the search vectors), about 2.5 KB a job, so it
    goes in batches with a VACUUM after each: that frees the old versions for
    the next batch to reuse, instead of growing the table by ~45 MB at once.
    """
    last_id, changed = 0, 0
    while True:
        with cursor() as cur:
            cur.execute(
                # Ashby jobs with an old stored value are left to the sync: the
                # salary field changed their fingerprint, so it rewrites them.
                "SELECT id, description_html, country FROM jobs "
                "WHERE id > %s AND comp_period IS NULL "
                "AND (ats <> 'ashby' OR comp_min IS NULL) "
                "AND (%s::bigint IS NULL OR company_id = %s) ORDER BY id LIMIT %s",
                (last_id, company_id, company_id, batch),
            )
            rows = cur.fetchall()
        if not rows:
            return changed
        last_id = rows[-1]["id"]

        updates = []
        for r in rows:
            found = pay.from_text(to_text(r["description_html"]), r["country"])
            if found:
                updates.append((found["comp_min"], found["comp_max"], found["comp_currency"],
                                found["comp_period"], r["id"]))
        if updates:
            with cursor(commit=True) as cur:
                cur.executemany(
                    "UPDATE jobs SET comp_min=%s, comp_max=%s, comp_currency=%s, comp_period=%s "
                    "WHERE id=%s",
                    updates,
                )
            with psycopg.connect(settings.database_url, autocommit=True) as conn:
                conn.execute("VACUUM jobs")
            changed += len(updates)
        if on_batch:
            on_batch(last_id, changed)

def load_companies(only: str | None = None, enabled_only: bool = True,
                   stale_hours: int | None = None,
                   limit: int | None = None, due: bool = False) -> list[Company]:
    sql = ["SELECT id, name, ats::text AS ats, board_token, ats_config FROM companies WHERE TRUE"]
    params: list[Any] = []
    if enabled_only:
        sql.append("AND enabled")
    if only:
        sql.append("AND (name ILIKE %s OR board_token ILIKE %s)")
        params += [only, only]
    if stale_hours is not None:
        sql.append("AND (last_synced_at IS NULL OR last_synced_at < now() - make_interval(hours => %s))")
        params.append(stale_hours)
    if due:
        sql.append(
            "AND (last_synced_at IS NULL"
            " OR last_synced_at < now() - %s"
            " OR (last_synced_at < now() - %s AND EXISTS ("
            "     SELECT 1 FROM jobs j WHERE j.company_id = companies.id AND j.closed_at IS NULL)))"
        )
        params += [QUIET_EVERY, ACTIVE_EVERY]
    # NULLS FIRST: never-synced boards are filled in before stale ones refresh.
    sql.append("ORDER BY last_synced_at NULLS FIRST, id")
    if limit is not None:
        sql.append("LIMIT %s")
        params.append(limit)

    with cursor() as cur:
        cur.execute(" ".join(sql), params)
        return [
            Company(id=r["id"], name=r["name"], ats=r["ats"],
                    board_token=r["board_token"], ats_config=r["ats_config"] or {})
            for r in cur.fetchall()
        ]


# --- phase 1: fetch (no database) ------------------------------------------------


@dataclass
class Fetched:
    """One board's download, normalized and filtered, ready to write."""
    company: Company
    started_at: datetime
    jobs: list[NormalizedJob] = field(default_factory=list)
    fetched: int = 0
    too_old: int = 0
    with_content: bool = False
    error: str | None = None


def fetch_company(company: Company, cutoff: datetime,
                  with_content: bool | None = None) -> Fetched:
    """Download and normalize one board. Never touches the database."""
    conn = connectors.get(company.ats)
    # Fetch descriptions inline when the ATS gives them away free; for
    # Greenhouse this is the one bulk content=true call.
    if with_content is None:
        with_content = not conn.descriptions_inline
    out = Fetched(company, datetime.now(timezone.utc), with_content=with_content)
    try:
        raw_jobs = list(conn.fetch_listings(company, with_content=with_content))
    except Exception as exc:  # noqa: BLE001 - recorded, then surfaced on admin
        log.exception("fetch failed for %s", company.name)
        out.error = str(exc)[:500]
        return out
    out.fetched = len(raw_jobs)
    for raw in raw_jobs:
        try:
            job = conn.normalize_job(company, raw)
        except Exception:  # noqa: BLE001 - one bad row must not fail the run
            log.exception("normalize failed for %s", company.name)
            continue
        if not job.external_id or not job.title:
            continue
        if is_too_old(job, cutoff):
            out.too_old += 1
            continue
        if not settings.store_raw:
            job.raw = {}  # never stored, so don't hold thousands of payloads in memory
        out.jobs.append(job)
    return out


# --- phase 2: write ----------------------------------------------------------------


def upsert_job(cur, company: Company, job: NormalizedJob, run_id: int,
               checked_before: datetime | None = None) -> None:
    """Insert a new job or update a changed one.

    checked_before: when this board was last checked before the job appeared.
    Only set on insert, never on update.
    """
    digest = job.content_hash()
    values = (
        company.id, company.ats, job.external_id, job.title, job.apply_url,
        job.department, job.team, job.employment_type,
        job.location_raw, job.locations, job.country, job.region,
        job.remote, job.remote_scope, job.open_to,
        job.comp_min, job.comp_max, job.comp_currency, job.comp_period,
        job.description_html,
        job.exp_min_years, job.exp_max_years, job.exp_source,
        job.posted_at, job.ats_updated_at,
        run_id, Jsonb(job.raw) if settings.store_raw else None, digest,
        checked_before,
    )
    cur.execute(
        """
        INSERT INTO jobs (
            company_id, ats, external_id, title, apply_url,
            department, team, employment_type,
            location_raw, locations, country, region,
            remote, remote_scope, open_to,
            comp_min, comp_max, comp_currency, comp_period,
            description_html,
            exp_min_years, exp_max_years, exp_source,
            posted_at, ats_updated_at,
            last_seen_run, raw, content_hash, board_checked_before
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (ats, company_id, external_id) DO UPDATE SET
            title=EXCLUDED.title,
            apply_url=EXCLUDED.apply_url,
            department=EXCLUDED.department,
            team=EXCLUDED.team,
            employment_type=EXCLUDED.employment_type,
            location_raw=EXCLUDED.location_raw,
            locations=EXCLUDED.locations,
            country=EXCLUDED.country,
            region=EXCLUDED.region,
            remote=EXCLUDED.remote,
            remote_scope=EXCLUDED.remote_scope,
            open_to=EXCLUDED.open_to,
            -- Pay is one unit too, and like the description a pass without
            -- text must not wipe a range read from it.
            comp_min=CASE WHEN EXCLUDED.comp_min IS NOT NULL
                          THEN EXCLUDED.comp_min ELSE jobs.comp_min END,
            comp_max=CASE WHEN EXCLUDED.comp_min IS NOT NULL
                          THEN EXCLUDED.comp_max ELSE jobs.comp_max END,
            comp_currency=CASE WHEN EXCLUDED.comp_min IS NOT NULL
                               THEN EXCLUDED.comp_currency ELSE jobs.comp_currency END,
            comp_period=CASE WHEN EXCLUDED.comp_min IS NOT NULL
                             THEN EXCLUDED.comp_period ELSE jobs.comp_period END,
            -- never overwrite a stored description with NULL: a listings-only
            -- pass must not wipe what a content pass already fetched.
            description_html=COALESCE(EXCLUDED.description_html, jobs.description_html),
            -- like descriptions, don't let a listings-only pass wipe these. The
            -- range moves as one unit: merging each end separately once made
            -- min 5 (new, "5+") with max 2 (old), which violates the range check.
            exp_min_years=CASE WHEN EXCLUDED.exp_min_years IS NOT NULL
                               THEN EXCLUDED.exp_min_years ELSE jobs.exp_min_years END,
            exp_max_years=CASE WHEN EXCLUDED.exp_min_years IS NOT NULL
                               THEN EXCLUDED.exp_max_years ELSE jobs.exp_max_years END,
            exp_source=CASE WHEN EXCLUDED.exp_min_years IS NOT NULL
                            THEN EXCLUDED.exp_source ELSE jobs.exp_source END,
            posted_at=COALESCE(EXCLUDED.posted_at, jobs.posted_at),
            ats_updated_at=EXCLUDED.ats_updated_at,
            last_seen_at=now(),
            last_seen_run=EXCLUDED.last_seen_run,
            closed_at=NULL,
            raw=EXCLUDED.raw,
            content_hash=EXCLUDED.content_hash,
            updated_at=now()
        """,
        values,
    )


def write_company(cur, f: Fetched, trigger: str) -> dict:
    """Record one fetched board. Unchanged jobs cost one bulk UPDATE, not one each."""
    company = f.company
    cur.execute(
        "INSERT INTO sync_runs (company_id, ats, trigger, status, started_at) "
        "VALUES (%s, %s, %s, 'running', %s) RETURNING id",
        (company.id, company.ats, trigger, f.started_at),
    )
    run_id = cur.fetchone()["id"]

    if f.error:
        cur.execute(
            "UPDATE sync_runs SET status='error', finished_at=now(), error=%s WHERE id=%s",
            (f.error, run_id),
        )
        cur.execute(
            "UPDATE companies SET last_synced_at=now(), last_error=%s, "
            "consecutive_failures=consecutive_failures+1 WHERE id=%s",
            (f.error, company.id),
        )
        return {"company": company.name, "status": "error", "error": f.error}

    cur.execute("SELECT last_success_at FROM companies WHERE id=%s", (company.id,))
    checked_before = cur.fetchone()["last_success_at"]  # None on a board's first sync
    cur.execute(
        "SELECT id, external_id, content_hash, closed_at FROM jobs WHERE company_id=%s",
        (company.id,),
    )
    existing = {r["external_id"]: r for r in cur.fetchall()}
    open_before = sum(r["closed_at"] is None for r in existing.values())

    created = updated = skipped = 0
    unchanged_ids: list[int] = []
    for job in f.jobs:
        known = existing.get(job.external_id)
        if known and known["content_hash"] == job.content_hash() and known["closed_at"] is None:
            unchanged_ids.append(known["id"])
            continue
        try:
            with cur.connection.transaction():  # a savepoint: one bad job can't sink the board
                upsert_job(cur, company, job, run_id, checked_before)
        except psycopg.Error:
            log.exception("could not save job %s for %s", job.external_id, company.name)
            skipped += 1
            if known:
                unchanged_ids.append(known["id"])  # still listed: don't let it be closed
            continue
        created += known is None
        updated += known is not None
    if unchanged_ids:
        cur.execute(
            "UPDATE jobs SET last_seen_at=now(), last_seen_run=%s WHERE id = ANY(%s)",
            (run_id, unchanged_ids),
        )

    # The guard: an empty board when we already hold jobs is far more likely
    # an upstream hiccup than a company closing every role at once. (A board
    # whose jobs are all too old isn't empty: they were fetched, just skipped.)
    suspicious = f.fetched == 0 and open_before > SUSPICIOUS_EMPTY_THRESHOLD
    closed = 0
    if not suspicious:
        cur.execute(
            "UPDATE jobs SET closed_at=now(), updated_at=now() "
            "WHERE company_id=%s AND closed_at IS NULL "
            "AND last_seen_run IS DISTINCT FROM %s",
            (company.id, run_id),
        )
        closed = cur.rowcount

    cur.execute(
        "UPDATE companies SET last_synced_at=now(), last_success_at=now(), "
        "consecutive_failures=0, last_error=NULL, verified_at=now(), "
        "first_synced_at=COALESCE(first_synced_at, %s) WHERE id=%s",
        (f.started_at, company.id),
    )
    status = "suspicious" if suspicious else "ok"
    unchanged = len(unchanged_ids)
    cur.execute(
        """UPDATE sync_runs SET status=%s, finished_at=now(), jobs_fetched=%s,
               jobs_created=%s, jobs_updated=%s, jobs_closed=%s, notes=%s
             WHERE id=%s""",
        (status, f.fetched, created, updated, closed,
         Jsonb({"unchanged": unchanged, "open_before": open_before, "skipped_bad": skipped,
                "with_content": f.with_content, "too_old": f.too_old}), run_id),
    )
    return {"company": company.name, "status": status, "fetched": f.fetched,
            "created": created, "updated": updated, "unchanged": unchanged,
            "closed": closed, "too_old": f.too_old}


def write_all(fetched: list[Fetched], trigger: str, workers: int = 4) -> list[dict]:
    """The write burst: a few connections, one transaction per board.

    A board that fails to write is rolled back and recorded as an error; it
    never stops the others (or the prune) from running.
    """
    def write(f: Fetched) -> dict:
        try:
            with cursor(commit=True) as cur:
                return write_company(cur, f, trigger)
        except Exception as exc:  # noqa: BLE001 - one board must not fail the run
            log.exception("write failed for %s", f.company.name)
            failed = Fetched(f.company, f.started_at, fetched=f.fetched,
                             error=f"write failed: {exc}"[:500])
            with cursor(commit=True) as cur:
                return write_company(cur, failed, trigger)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(write, fetched))


# --- entry points ------------------------------------------------------------------


def sync_company(company: Company, trigger: str = "manual",
                 with_content: bool | None = None) -> dict:
    """Sync one board (used by add-url and the admin page)."""
    f = fetch_company(company, age_cutoff(), with_content)
    with cursor(commit=True) as cur:
        return write_company(cur, f, trigger)


def sync_all(only: str | None = None, stale_hours: int | None = None,
             trigger: str = "manual", workers: int = 4,
             limit: int | None = None, due: bool = False) -> tuple[list[dict], int]:
    """Fetch the boards, write them in one burst, then prune.

    Returns (per-company results, jobs pruned).
    """
    companies = load_companies(only=only, stale_hours=stale_hours, limit=limit, due=due)
    # Let the database idle (and a serverless one suspend) while we download.
    close_pool()

    cutoff = age_cutoff()
    t0 = time.monotonic()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        fetched = list(pool.map(lambda c: fetch_company(c, cutoff), companies))
    t1 = time.monotonic()

    results = write_all(fetched, trigger)
    # Also catches jobs on boards that weren't synced this time (or keep failing).
    pruned = prune()
    t2 = time.monotonic()
    close_pool()
    log.info("fetched %s boards in %.0fs, wrote in %.0fs; pruned %s jobs older than %s days",
             len(companies), t1 - t0, t2 - t1, pruned, settings.max_job_age_days)
    return results, pruned
