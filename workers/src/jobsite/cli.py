"""jobsite CLI — the same functions the scheduler calls."""
from __future__ import annotations

import concurrent.futures as cf
import logging
from pathlib import Path

import typer

from . import discovery, sync
from .db import cursor

app = typer.Typer(add_completion=False, help="ATS job aggregator")


def _setup_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    # httpx logs a line per request; far too chatty for a 40-company sync.
    logging.getLogger("httpx").setLevel(logging.DEBUG if verbose else logging.WARNING)


@app.command("discover")
def discover(
    seeds: Path = typer.Option(Path("../db/seed/companies.txt"), help="File of company names"),
    workers: int = typer.Option(6, help="Parallel probes"),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
    """Probe company names against Tier-1 ATSs and add the boards that exist."""
    _setup_logging(verbose)
    names = [
        line.strip() for line in seeds.read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]
    typer.echo(f"probing {len(names)} names…")

    added = matched = 0
    with cf.ThreadPoolExecutor(max_workers=workers) as pool:
        results = pool.map(lambda n: (n, discovery.probe_name(n)), names)
        for name, match in results:
            if not match:
                typer.echo(f"  ✗ {name}")
                continue
            matched += 1
            new_id = discovery.add_company(match, name)
            added += bool(new_id)
            flag = "+" if new_id else "=";
            typer.echo(f"  {flag} {name:20} {match.ats:11} {match.token:20} {match.job_count:5} jobs")

    typer.echo(f"\nmatched {matched}/{len(names)}, added {added} new")


@app.command("add-url")
def add_url(url: str) -> None:
    """Add one company from a careers URL (or a bare name)."""
    _setup_logging()
    match = discovery.resolve(url)
    if not match:
        typer.echo("no ATS board found for that input")
        raise typer.Exit(1)
    typer.echo(f"{match.ats} / {match.token} — {match.job_count} jobs")
    for title in (match.sample_titles or [])[:3]:
        typer.echo(f"   · {title}")
    new_id = discovery.add_company(match, match.company_name or match.token,
                                   source="admin_paste")
    typer.echo("added" if new_id else "already tracked")


@app.command("sync")
def sync_cmd(
    company: str = typer.Option(None, "--company", "-c", help="Name or token"),
    stale_hours: int = typer.Option(None, help="Only companies not synced in N hours"),
    workers: int = typer.Option(4),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
    """Fetch boards and upsert jobs."""
    _setup_logging(verbose)
    results = sync.sync_all(only=company, stale_hours=stale_hours, workers=workers)

    ok = sum(r["status"] == "ok" for r in results)
    total = sum(r.get("fetched", 0) for r in results)
    created = sum(r.get("created", 0) for r in results)
    closed = sum(r.get("closed", 0) for r in results)
    for r in results:
        if r["status"] != "ok":
            typer.echo(f"  ! {r['company']}: {r['status']} {r.get('error','')}")
    typer.echo(
        f"\n{ok}/{len(results)} ok · {total} fetched · {created} new · {closed} closed"
    )


@app.command("stats")
def stats() -> None:
    """Quick health check of what's in the database."""
    with cursor() as cur:
        cur.execute("SELECT count(*) n FROM companies WHERE enabled")
        companies = cur.fetchone()["n"]
        cur.execute("SELECT count(*) n FROM jobs WHERE closed_at IS NULL")
        open_jobs = cur.fetchone()["n"]
        cur.execute("SELECT count(*) n FROM jobs WHERE closed_at IS NOT NULL")
        closed_jobs = cur.fetchone()["n"]
        cur.execute("SELECT count(*) n FROM jobs WHERE closed_at IS NULL AND remote")
        remote = cur.fetchone()["n"]
        cur.execute(
            "SELECT count(*) n FROM jobs WHERE closed_at IS NULL AND description_text IS NOT NULL"
        )
        described = cur.fetchone()["n"]
        cur.execute(
            """SELECT c.name, c.ats::text AS ats, count(j.id) n
                 FROM companies c LEFT JOIN jobs j
                   ON j.company_id=c.id AND j.closed_at IS NULL
                GROUP BY c.id, c.name, c.ats ORDER BY n DESC LIMIT 10"""
        )
        top = cur.fetchall()

    typer.echo(f"companies : {companies}")
    typer.echo(f"open jobs : {open_jobs}  (remote {remote}, with description {described})")
    typer.echo(f"closed    : {closed_jobs}")
    typer.echo("\ntop boards:")
    for row in top:
        typer.echo(f"  {row['name'][:24]:24} {row['ats']:11} {row['n']:5}")


if __name__ == "__main__":
    app()
