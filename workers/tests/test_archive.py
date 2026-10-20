"""The weekly report's copy of the roles outlives the jobs it was made from."""
from datetime import date, datetime, timedelta, timezone

from jobsite import archive, connectors, sync
from jobsite.models import NormalizedJob

from .conftest import FakeBoard


def test_week_of_is_the_monday():
    assert archive.week_of(date(2026, 10, 20)) == date(2026, 10, 19)  # a Tuesday
    assert archive.week_of(date(2026, 10, 19)) == date(2026, 10, 19)
    assert archive.week_of(date(2026, 10, 25)) == date(2026, 10, 19)  # the Sunday


# --- against the dev database (skipped when it isn't running) -----------------


def archived(company_id):
    from jobsite.db import cursor

    with cursor() as cur:
        cur.execute("SELECT title, skills FROM report_roles WHERE company_id=%s ORDER BY title_key", (company_id,))
        return [(r["title"], r["skills"]) for r in cur.fetchall()]


def test_roles_are_copied_once_and_kept_after_the_jobs_go(test_company, monkeypatch):
    from jobsite.db import cursor

    now = datetime.now(timezone.utc)
    posted = now - timedelta(hours=1)
    board = [
        NormalizedJob(external_id="1", title="Python Engineer", apply_url="https://example.com/1",
                      posted_at=posted, description_html="<p>Python and SQL on AWS.</p>"),
        # The same role in another city: still one role.
        NormalizedJob(external_id="2", title="python engineer", apply_url="https://example.com/2",
                      posted_at=posted, description_html="<p>Python and SQL on AWS.</p>"),
        NormalizedJob(external_id="3", title="Recruiter", apply_url="https://example.com/3", posted_at=posted),
    ]
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard(board))
    try:
        sync.sync_company(test_company)
        archive.archive_roles(now)
        rows = archived(test_company.id)
        assert [t.lower() for t, _ in rows] == ["python engineer", "recruiter"]
        assert set(rows[0][1]) == {"Python", "SQL", "AWS"} and rows[1][1] == []

        assert archive.archive_roles(now) == 0  # nothing new to copy
        sync.prune(now + timedelta(days=30), company_id=test_company.id)
        assert archived(test_company.id) == rows
    finally:
        with cursor(commit=True) as cur:
            cur.execute("DELETE FROM report_roles WHERE company_id=%s", (test_company.id,))
