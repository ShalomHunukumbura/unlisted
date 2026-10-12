"""Google Indexing API notifications: what's sent, in what order, within the daily budget."""
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from jobsite import connectors, indexing, sync
from jobsite.db import cursor
from jobsite.models import NormalizedJob

from .conftest import FakeBoard

# Newer than anything else in the database, so these are announced first.
POSTED = datetime.now(timezone.utc) - timedelta(minutes=1)


def job(external_id: str) -> NormalizedJob:
    return NormalizedJob(external_id=external_id, title=f"Job {external_id}",
                         apply_url=f"https://example.com/{external_id}", posted_at=POSTED)


@pytest.fixture
def board(test_company, monkeypatch):
    """The test company's board (a list to edit, then `resync()`), with no pings recorded."""
    jobs: list[NormalizedJob] = []
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard(jobs))

    def resync() -> dict[str, int]:
        sync.sync_company(test_company)
        with cursor() as cur:
            cur.execute("SELECT external_id, id FROM jobs WHERE company_id=%s", (test_company.id,))
            return {r["external_id"]: r["id"] for r in cur.fetchall()}

    with cursor(commit=True) as cur:
        cur.execute("TRUNCATE index_pings")
    yield jobs, resync
    with cursor(commit=True) as cur:
        cur.execute("TRUNCATE index_pings")


class Google:
    """Stands in for the Indexing API and keeps what it was sent."""

    def __init__(self, status: int = 200):
        self.status, self.sent, self.tokens = status, [], set()
        self.client = httpx.Client(transport=httpx.MockTransport(self.handle))

    def handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.sent.append((body["type"], body["url"]))
        self.tokens.add(request.headers["authorization"])
        return httpx.Response(self.status, json={})


def test_a_new_role_is_announced_once(board):
    jobs, resync = board
    jobs.append(job("a"))
    ids = resync()
    google = Google()
    result = indexing.notify(limit=1, client=google.client, token="t")
    assert google.sent == [("URL_UPDATED", f"https://findunlisted.link/jobs/{ids['a']}")]
    assert google.tokens == {"Bearer t"}
    assert (result.announced, result.removed, result.failed) == (1, 0, 0)

    # the day's budget of 1 is spent, and the role isn't new any more
    again = Google()
    assert indexing.notify(limit=1, client=again.client, token="t").announced == 0
    assert again.sent == []
    assert ids["a"] not in indexing.fresh(100000)


def test_closed_roles_come_first_and_reopened_ones_are_new_again(board):
    jobs, resync = board
    jobs[:] = [job("a"), job("b")]
    ids = resync()
    for i in ids.values():
        indexing.record(i, "URL_UPDATED")

    jobs[:] = [job("a")]  # b closes
    resync()
    assert indexing.gone(10) == [ids["b"]]
    google = Google()
    result = indexing.notify(limit=3, client=google.client, token="t")  # 2 of the 3 already used
    assert google.sent == [("URL_DELETED", f"https://findunlisted.link/jobs/{ids['b']}")]
    assert result.removed == 1
    assert indexing.gone(10) == []
    assert indexing.budget_left(3) == 0

    jobs[:] = [job("a"), job("b")]  # b is back
    resync()
    fresh = indexing.fresh(100000)
    assert ids["b"] in fresh and ids["a"] not in fresh


def test_stops_when_google_says_the_quota_is_spent(board):
    jobs, resync = board
    jobs[:] = [job("a"), job("b")]
    resync()
    google = Google(status=429)
    result = indexing.notify(limit=50, client=google.client, token="t")
    assert len(google.sent) == 1
    assert result.stopped and result.failed == 1 and result.announced == 0
    assert indexing.budget_left(50) == 50  # nothing was recorded as sent


def test_dry_run_sends_nothing(board):
    jobs, resync = board
    jobs.append(job("a"))
    resync()
    result = indexing.notify(limit=1, dry_run=True)
    assert (result.announced, result.removed) == (1, 0)
    assert indexing.budget_left(1) == 1
