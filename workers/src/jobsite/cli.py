"""jobsite CLI — the same functions the scheduler calls."""
from __future__ import annotations

import concurrent.futures as cf
import logging
from pathlib import Path

import typer

from . import connectors, discovery, sync
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


@app.command("import-boards")
def import_boards(
    path: Path = typer.Argument(..., help="File of board tokens, one per line"),
    ats: str = typer.Option("ashby", help="Which ATS these tokens belong to"),
    workers: int = typer.Option(6, help="Parallel validations"),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
    """Import a list of known board tokens for one ATS.

    Unlike `discover`, which guesses slugs from company names, this takes tokens
    you already have (e.g. exported from a shared tracking sheet). Boards that
    404 or return zero jobs are skipped, so a stale list is harmless.
    """
    _setup_logging(verbose)
    conn = connectors.get(ats)

    # Accept either a plain token list or a name,slug,url CSV. The CSV form
    # carries a real company name, which Ashby's API never returns.
    names: dict[str, str] = {}
    if path.suffix.lower() == ".csv":
        import csv as _csv

        with path.open(newline="") as fh:
            for row in _csv.DictReader(fh):
                slug = (row.get("slug") or "").strip()
                if slug:
                    names[slug] = (row.get("name") or slug).strip() or slug
        tokens = list(names)
    else:
        tokens = [
            line.strip() for line in path.read_text().splitlines()
            if line.strip() and not line.startswith("#")
        ]
    typer.echo(f"validating {len(tokens)} {ats} boards…")

    live_count = added = empty = dead = 0
    total_jobs = 0

    def check(tok: str):
        try:
            return tok, conn.validate_token(tok)
        except Exception:  # noqa: BLE001
            return tok, None

    # Insert as we go and report progress: validating thousands of boards takes
    # a while, and a run that dies at 90% should not lose everything.
    with cf.ThreadPoolExecutor(max_workers=workers) as pool:
        for i, (tok, res) in enumerate(pool.map(check, tokens), 1):
            if res is None or not res.ok:
                dead += 1
            elif res.job_count > 0:
                live_count += 1
                total_jobs += res.job_count
                match = discovery.Match(ats=ats, token=tok, job_count=res.job_count,
                                        sample_titles=res.sample_titles)
                if discovery.add_company(match, names.get(tok, tok), source="seed",
                                         prefer_given_name=bool(names)):
                    added += 1
            else:
                empty += 1

            if i % 250 == 0 or i == len(tokens):
                typer.echo(f"  {i}/{len(tokens)} · {live_count} live · "
                           f"{added} added · {empty} empty · {dead} dead")

    typer.echo(
        f"\n{live_count} live ({total_jobs} jobs) · {empty} empty · {dead} dead\n"
        f"added {added} new, {live_count - added} already tracked"
    )


@app.command("sync")
def sync_cmd(
    company: str = typer.Option(None, "--company", "-c", help="Name or token"),
    stale_hours: int = typer.Option(None, help="Only companies not synced in N hours"),
    limit: int = typer.Option(None, help="Sync at most N companies (never-synced first)"),
    due: bool = typer.Option(False, "--due", help="Only boards due a check: those with open jobs "
                             "after ~1h, quiet ones after ~6h (for an hourly schedule)"),
    workers: int = typer.Option(4),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
    """Fetch boards and upsert jobs."""
    _setup_logging(verbose)
    results, pruned = sync.sync_all(only=company, stale_hours=stale_hours, workers=workers,
                                    limit=limit, due=due)

    ok = sum(r["status"] == "ok" for r in results)
    total = sum(r.get("fetched", 0) for r in results)
    created = sum(r.get("created", 0) for r in results)
    closed = sum(r.get("closed", 0) for r in results)
    too_old = sum(r.get("too_old", 0) for r in results)
    for r in results:
        if r["status"] != "ok":
            typer.echo(f"  ! {r['company']}: {r['status']} {r.get('error','')}")
    typer.echo(
        f"\n{ok}/{len(results)} ok · {total} fetched · {created} new · {closed} closed"
        f" · {too_old} skipped as too old · {pruned} pruned"
    )


@app.command("prune")
def prune_cmd() -> None:
    """Delete jobs older than MAX_JOB_AGE_DAYS (default 7). Sync does this too."""
    from .config import settings

    pruned = sync.prune()
    typer.echo(f"deleted {pruned} jobs older than {settings.max_job_age_days} days")


@app.command("backfill-pay")
def backfill_pay_cmd() -> None:
    """One-off: read pay ranges out of the descriptions of jobs already stored."""
    _setup_logging()
    changed = sync.backfill_pay(
        on_batch=lambda last_id, n: typer.echo(f"  up to id {last_id}: {n} jobs with pay so far"))
    typer.echo(f"done: pay found for {changed} jobs")


@app.command("embed")
def embed_cmd(
    max_seconds: float = typer.Option(900, help="Stop after this long; the rest waits for the next run"),
) -> None:
    """Embed open jobs that don't have one yet, for the "For you" feed (needs the embed extra)."""
    _setup_logging()
    from . import embed

    typer.echo(f"embedded {embed.embed_new(max_seconds=max_seconds)} jobs")


@app.command("blog-drafts")
def blog_drafts_cmd(
    content: Path = typer.Option(Path("../web/content"), help="The web app's content folder"),
    week: str = typer.Option(None, help="The Monday of the week to write about (default: last week)"),
    facts_only: bool = typer.Option(False, "--facts-only", help="Print the facts the model would get; write nothing"),
    notes_file: Path = typer.Option(None, help="Write the review notes here (Markdown, for the pull request)"),
) -> None:
    """Draft the weekly report's words and a topic post with GitHub Models (needs GITHUB_TOKEN)."""
    import datetime as dt
    import json

    from . import blogwriter

    _setup_logging()
    today = dt.datetime.now(dt.timezone.utc).date()
    monday = dt.date.fromisoformat(week) if week else blogwriter.last_week(today)
    if facts_only:
        stats, previous = blogwriter.reports(monday)
        if not stats:
            typer.echo(f"no numbers saved for the week of {monday}")
            raise typer.Exit(1)
        topic = blogwriter.pick_topic(monday, stats, previous)
        typer.echo(json.dumps({"week": monday, "topic": topic.kind, "brief": topic.brief,
                               "links": topic.links, "facts": topic.facts}, indent=2, default=str))
        return
    drafts = blogwriter.run(content, monday, today)
    lines = []
    for d in drafts:
        typer.echo(f"wrote {d.path}")
        lines.append(f"### {d.title}\n`{d.path.relative_to(content.parent)}`\n")
        lines += [f"- {n}" for n in d.notes] or ["- Nothing flagged."]
        lines.append("")
    if notes_file:
        notes_file.write_text("\n".join(lines))


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
            "SELECT count(*) n FROM jobs WHERE closed_at IS NULL AND description_html IS NOT NULL"
        )
        described = cur.fetchone()["n"]
        cur.execute("SELECT count(*) n FROM jobs WHERE closed_at IS NULL AND comp_period IS NOT NULL")
        with_pay = cur.fetchone()["n"]
        # Neon's free tier stops writes at 512 MB; this is the figure it counts.
        cur.execute("SELECT pg_database_size(current_database()) / 1048576 AS mb")
        size_mb = cur.fetchone()["mb"]
        cur.execute(
            """SELECT c.name, c.ats::text AS ats, count(j.id) n
                 FROM companies c LEFT JOIN jobs j
                   ON j.company_id=c.id AND j.closed_at IS NULL
                GROUP BY c.id, c.name, c.ats ORDER BY n DESC LIMIT 10"""
        )
        top = cur.fetchall()

    with cursor() as cur:
        cur.execute(
            """SELECT ats::text AS ats, count(*) n,
                      count(*) FILTER (WHERE last_synced_at IS NULL) unsynced
                 FROM companies WHERE enabled GROUP BY ats ORDER BY n DESC"""
        )
        by_ats = cur.fetchall()

    typer.echo(f"companies : {companies}")
    for row in by_ats:
        pending = f", {row['unsynced']} not yet synced" if row["unsynced"] else ""
        typer.echo(f"  {row['ats']:12} {row['n']:5}{pending}")
    typer.echo(f"open jobs : {open_jobs}  (remote {remote}, with description {described}, with pay {with_pay})")
    typer.echo(f"closed    : {closed_jobs}")
    typer.echo(f"db size   : {size_mb} MB")
    typer.echo("\ntop boards:")
    for row in top:
        typer.echo(f"  {row['name'][:24]:24} {row['ats']:11} {row['n']:5}")


if __name__ == "__main__":
    app()
