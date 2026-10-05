"""Sync orchestration: fetch, upsert, detect closures, prune, record the run.

A job that stops appearing in a company's board is stamped closed_at; if it
comes back, the upsert reopens it. Jobs older than settings.max_job_age_days
(by posted_at, or first_seen_at when the ATS gives no date) are never stored:
sync skips them and prune() deletes any that have aged out since.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from psycopg.types.json import Jsonb

from . import connectors
from .config import settings
from .db import cursor
from .models import Company, NormalizedJob

log = logging.getLogger(__name__)

# If a board returns nothing but we already hold more than this many open jobs,
# treat it as a suspicious response and refuse to close them. Without this, one
# bad upstream response silently wipes a company's entire board.
SUSPICIOUS_EMPTY_THRESHOLD = 5


def age_cutoff(now: datetime | None = None) -> datetime:
    """Anything posted before this is too old to keep."""
    return (now or datetime.now(timezone.utc)) - timedelta(days=settings.max_job_age_days)


def is_too_old(job: NormalizedJob, cutoff: datetime) -> bool:
    # No posted date: keep it; prune ages it out by first_seen_at instead.
    return job.posted_at is not None and job.posted_at < cutoff


def prune(cutoff: datetime | None = None, company_id: int | None = None) -> int:
    """Delete jobs older than the cutoff (for one company, or all). Returns how many."""
    with cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM jobs WHERE COALESCE(posted_at, first_seen_at) < %s "
            "AND (%s::bigint IS NULL OR company_id = %s)",
            (cutoff or age_cutoff(), company_id, company_id),
        )
        return cur.rowcount


def load_companies(only: str | None = None, enabled_only: bool = True,
                   stale_hours: int | None = None,
                   limit: int | None = None) -> list[Company]:
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


def _start_run(company: Company, trigger: str) -> int:
    with cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO sync_runs (company_id, ats, trigger, status) "
            "VALUES (%s, %s, %s, 'running') RETURNING id",
            (company.id, company.ats, trigger),
        )
        return cur.fetchone()["id"]


def _finish_run(run_id: int, status: str, **counts) -> None:
    with cursor(commit=True) as cur:
        cur.execute(
            """UPDATE sync_runs SET status=%s, finished_at=now(),
                   jobs_fetched=%s, jobs_created=%s, jobs_updated=%s, jobs_closed=%s,
                   error=%s, notes=%s
                 WHERE id=%s""",
            (status, counts.get("fetched", 0), counts.get("created", 0),
             counts.get("updated", 0), counts.get("closed", 0),
             counts.get("error"), Jsonb(counts.get("notes") or {}), run_id),
        )


def upsert_job(cur, company: Company, job: NormalizedJob, run_id: int) -> str:
    """Insert or update one job. Returns 'created' | 'updated' | 'unchanged'.

    content_hash lets an unchanged job skip the write entirely, so repeat syncs
    don't churn the GIN index.
    """
    cur.execute(
        "SELECT id, content_hash, closed_at FROM jobs "
        "WHERE ats=%s AND company_id=%s AND external_id=%s",
        (company.ats, company.id, job.external_id),
    )
    existing = cur.fetchone()
    digest = job.content_hash()

    if existing and existing["content_hash"] == digest and existing["closed_at"] is None:
        cur.execute(
            "UPDATE jobs SET last_seen_at=now(), last_seen_run=%s WHERE id=%s",
            (run_id, existing["id"]),
        )
        return "unchanged"

    values = (
        company.id, company.ats, job.external_id, job.title, job.apply_url,
        job.department, job.team, job.employment_type,
        job.location_raw, job.locations, job.country, job.region,
        job.remote, job.remote_scope, job.open_to,
        job.comp_min, job.comp_max, job.comp_currency,
        job.description_html,
        job.exp_min_years, job.exp_max_years, job.exp_source,
        job.posted_at, job.ats_updated_at,
        run_id, Jsonb(job.raw) if settings.store_raw else None, digest,
    )
    cur.execute(
        """
        INSERT INTO jobs (
            company_id, ats, external_id, title, apply_url,
            department, team, employment_type,
            location_raw, locations, country, region,
            remote, remote_scope, open_to,
            comp_min, comp_max, comp_currency,
            description_html,
            exp_min_years, exp_max_years, exp_source,
            posted_at, ats_updated_at,
            last_seen_run, raw, content_hash
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
            comp_min=EXCLUDED.comp_min,
            comp_max=EXCLUDED.comp_max,
            comp_currency=EXCLUDED.comp_currency,
            -- never overwrite a stored description with NULL: a listings-only
            -- pass must not wipe what a content pass already fetched.
            description_html=COALESCE(EXCLUDED.description_html, jobs.description_html),
            -- like descriptions, don't let a listings-only pass wipe these
            exp_min_years=COALESCE(EXCLUDED.exp_min_years, jobs.exp_min_years),
            exp_max_years=COALESCE(EXCLUDED.exp_max_years, jobs.exp_max_years),
            exp_source=COALESCE(EXCLUDED.exp_source, jobs.exp_source),
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
    return "created" if not existing else "updated"


def sync_company(company: Company, trigger: str = "manual",
                 with_content: bool | None = None) -> dict:
    """Sync one company's board. Returns a result summary."""
    conn = connectors.get(company.ats)
    run_id = _start_run(company, trigger)

    # Fetch descriptions inline when the ATS gives them away free; for
    # Greenhouse this is the one bulk content=true call.
    if with_content is None:
        with_content = not conn.descriptions_inline

    created = updated = unchanged = too_old = 0
    cutoff = age_cutoff()
    try:
        raw_jobs = list(conn.fetch_listings(company, with_content=with_content))
    except Exception as exc:  # noqa: BLE001 - recorded, then surfaced on admin
        log.exception("fetch failed for %s", company.name)
        _finish_run(run_id, "error", error=str(exc)[:500])
        with cursor(commit=True) as cur:
            cur.execute(
                "UPDATE companies SET last_synced_at=now(), last_error=%s, "
                "consecutive_failures=consecutive_failures+1 WHERE id=%s",
                (str(exc)[:500], company.id),
            )
        return {"company": company.name, "status": "error", "error": str(exc)}

    with cursor(commit=True) as cur:
        cur.execute(
            "SELECT count(*) AS n FROM jobs WHERE company_id=%s AND closed_at IS NULL",
            (company.id,),
        )
        open_before = cur.fetchone()["n"]

        for raw in raw_jobs:
            try:
                job = conn.normalize_job(company, raw)
            except Exception:  # noqa: BLE001 - one bad row must not fail the run
                log.exception("normalize failed for %s", company.name)
                continue
            if not job.external_id or not job.title:
                continue
            if is_too_old(job, cutoff):
                too_old += 1
                continue
            outcome = upsert_job(cur, company, job, run_id)
            created += outcome == "created"
            updated += outcome == "updated"
            unchanged += outcome == "unchanged"

        # The guard: an empty board when we already hold jobs is far more likely
        # an upstream hiccup than a company closing every role at once. (A board
        # whose jobs are all too old isn't empty: they were fetched, just skipped.)
        suspicious = not raw_jobs and open_before > SUSPICIOUS_EMPTY_THRESHOLD
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
            "consecutive_failures=0, last_error=NULL, verified_at=now() WHERE id=%s",
            (company.id,),
        )

    status = "suspicious" if suspicious else "ok"
    _finish_run(run_id, status, fetched=len(raw_jobs), created=created,
                updated=updated, closed=closed,
                notes={"unchanged": unchanged, "open_before": open_before,
                       "with_content": with_content, "too_old": too_old})

    return {"company": company.name, "status": status, "fetched": len(raw_jobs),
            "created": created, "updated": updated, "unchanged": unchanged,
            "closed": closed, "too_old": too_old}


def sync_all(only: str | None = None, stale_hours: int | None = None,
             trigger: str = "manual", workers: int = 4,
             limit: int | None = None) -> tuple[list[dict], int]:
    """Sync the boards, then prune. Returns (per-company results, jobs pruned)."""
    from concurrent.futures import ThreadPoolExecutor

    companies = load_companies(only=only, stale_hours=stale_hours, limit=limit)
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for res in pool.map(lambda c: sync_company(c, trigger=trigger), companies):
            results.append(res)
            log.info("synced %s", res)
    # Also catches jobs on boards that weren't synced this time (or keep failing).
    pruned = prune()
    log.info("pruned %s jobs older than %s days", pruned, settings.max_job_age_days)
    return results, pruned
