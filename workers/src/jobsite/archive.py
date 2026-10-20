"""A lean copy of each week's roles, for the weekly report and the blog drafts.

Jobs are deleted settings.max_job_age_days (3) after they're posted, long
before the week they were posted in is over, so a week's numbers can't be
worked out from `jobs` at the end of it. After every sync this copies the
roles of this week and last week that aren't copied yet into report_roles
(migration 0019): one row per role (company + title), with the report's
skills found while the description is still stored.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from .db import cursor

# The skills in the weekly report (web/src/lib/reports.ts lists the same
# names), and the words each is searched for by.
SKILLS = {
    "Python": "python", "SQL": "sql", "AWS": "aws", "TypeScript": "typescript", "React": "react",
    "Java": "java", "Kubernetes": "kubernetes", "Go": "golang", "Rust": "rust", "Salesforce": "salesforce",
}

# This week, last week and the one before (the blog can be re-run for it).
KEEP_WEEKS = 3


def week_of(day: date) -> date:
    """The Monday a date's ISO week starts."""
    return day - timedelta(days=day.weekday())


def archive_roles(now: datetime | None = None) -> int:
    """Copy the roles not copied yet. Returns how many."""
    this_week = week_of((now or datetime.now(timezone.utc)).date())
    with cursor(commit=True) as cur:
        # Only postings whose role isn't stored yet, so each sync searches the
        # descriptions of its new roles only. The newest posting of a role
        # stands for it, as in the lists.
        cur.execute(
            """
            INSERT INTO report_roles (week, company_id, title_key, job_id, title, location_raw,
                                      remote, open_to, region, country,
                                      comp_min, comp_max, comp_currency, comp_period, at, skills)
            SELECT DISTINCT ON (n.week, n.company_id, lower(n.title))
                   n.week, n.company_id, lower(n.title), n.id, n.title, n.location_raw,
                   n.remote, n.open_to, n.region, n.country,
                   n.comp_min, n.comp_max, n.comp_currency, n.comp_period, n.at,
                   ARRAY(SELECT s.name FROM unnest(%(names)s::text[], %(words)s::text[]) AS s(name, q)
                          WHERE n.search_tsv @@ plainto_tsquery('english', s.q))
              FROM (SELECT j.*, COALESCE(j.posted_at, j.first_seen_at) AS at,
                           date_trunc('week', COALESCE(j.posted_at, j.first_seen_at) AT TIME ZONE 'UTC')::date AS week
                      FROM jobs j
                     WHERE COALESCE(j.posted_at, j.first_seen_at) >= %(since)s) n
             WHERE NOT EXISTS (SELECT 1 FROM report_roles r
                                WHERE r.week = n.week AND r.company_id = n.company_id
                                  AND r.title_key = lower(n.title))
             ORDER BY n.week, n.company_id, lower(n.title), n.at DESC, n.id DESC
            ON CONFLICT DO NOTHING
            """,
            {"names": list(SKILLS), "words": list(SKILLS.values()),
             "since": datetime.combine(this_week - timedelta(days=7), datetime.min.time(), timezone.utc)},
        )
        copied = cur.rowcount
        cur.execute("DELETE FROM report_roles WHERE week < %s",
                    (this_week - timedelta(weeks=KEEP_WEEKS - 1),))
        return copied
