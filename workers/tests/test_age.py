"""Jobs older than max_job_age_days are never stored, and prune removes ones that age out."""
from datetime import datetime, timedelta, timezone

import pytest

from jobsite import connectors, sync
from jobsite.config import settings
from jobsite.models import Company, NormalizedJob

NOW = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)


def job(external_id: str, days_old: float | None) -> NormalizedJob:
    posted = None if days_old is None else NOW - timedelta(days=days_old)
    return NormalizedJob(external_id=external_id, title=f"Job {external_id}",
                         apply_url=f"https://example.com/{external_id}", posted_at=posted)


def test_cutoff_is_two_weeks():
    assert settings.max_job_age_days == 14
    assert sync.age_cutoff(NOW) == NOW - timedelta(days=14)


@pytest.mark.parametrize("days_old,too_old", [(0, False), (13.9, False), (14.1, True), (90, True), (None, False)])
def test_is_too_old(days_old, too_old):
    assert sync.is_too_old(job("x", days_old), sync.age_cutoff(NOW)) is too_old


# --- against the dev database (skipped when it isn't running) -----------------


@pytest.fixture
def test_company():
    from jobsite.db import cursor

    try:
        with cursor(commit=True) as cur:
            cur.execute(
                "INSERT INTO companies (name, ats, board_token, source) "
                "VALUES ('pytest age co', 'lever', 'pytest-age-test', 'test') RETURNING id"
            )
            company_id = cur.fetchone()["id"]
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"database not available: {exc}")
    yield Company(id=company_id, name="pytest age co", ats="lever", board_token="pytest-age-test", ats_config={})
    with cursor(commit=True) as cur:
        cur.execute("DELETE FROM companies WHERE id=%s", (company_id,))  # cascades to its jobs


class FakeBoard:
    descriptions_inline = True

    def __init__(self, jobs):
        self.jobs = jobs

    def fetch_listings(self, company, with_content=False):
        return self.jobs

    def normalize_job(self, company, raw):
        return raw


def stored(company_id):
    from jobsite.db import cursor

    with cursor() as cur:
        cur.execute("SELECT external_id FROM jobs WHERE company_id=%s ORDER BY external_id", (company_id,))
        return [r["external_id"] for r in cur.fetchall()]


def test_sync_skips_old_jobs_and_prune_removes_aged_ones(test_company, monkeypatch):
    real_now = datetime.now(timezone.utc)
    board = [job("fresh", 1), job("no-date", None), job("old", 30)]
    for j in board:  # make the ages relative to the real clock the sync uses
        if j.posted_at:
            j.posted_at = real_now - (NOW - j.posted_at)
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard(board))

    result = sync.sync_company(test_company)
    assert result["created"] == 2 and result["too_old"] == 1
    assert stored(test_company.id) == ["fresh", "no-date"]

    # three weeks later: both have aged out (no-date by first_seen_at). Scoped to
    # the test company: a future cutoff would otherwise empty the whole dev table.
    three_weeks_on = real_now + timedelta(days=21) - timedelta(days=settings.max_job_age_days)
    assert sync.prune(three_weeks_on, company_id=test_company.id) == 2
    assert stored(test_company.id) == []


def test_store_raw_off_keeps_payload_out_of_the_database(test_company, monkeypatch):
    from jobsite.db import cursor

    fresh = job("fresh", 0)
    fresh.posted_at = datetime.now(timezone.utc)
    fresh.raw = {"big": "payload"}
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard([fresh]))
    monkeypatch.setattr(settings, "store_raw", False)
    sync.sync_company(test_company)
    with cursor() as cur:
        cur.execute("SELECT raw, description_html FROM jobs WHERE company_id=%s", (test_company.id,))
        row = cur.fetchone()
    assert row["raw"] is None
