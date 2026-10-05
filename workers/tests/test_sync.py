"""The two-phase sync: download with no database connection, then one write burst."""
from datetime import datetime, timedelta, timezone

from jobsite import connectors, db, sync
from jobsite.db import cursor
from jobsite.models import NormalizedJob

from .conftest import FakeBoard


# Fixed, like real board data: posted_at is part of a job's change fingerprint.
POSTED = datetime.now(timezone.utc) - timedelta(days=1)


def job(external_id: str, title: str | None = None) -> NormalizedJob:
    return NormalizedJob(external_id=external_id, title=title or f"Job {external_id}",
                         apply_url=f"https://example.com/{external_id}", posted_at=POSTED)


def rows(company_id):
    with cursor() as cur:
        cur.execute("SELECT external_id, title, last_seen_run, closed_at, updated_at FROM jobs "
                    "WHERE company_id=%s ORDER BY external_id", (company_id,))
        return {r["external_id"]: r for r in cur.fetchall()}


def last_run(company_id):
    with cursor() as cur:
        cur.execute("SELECT * FROM sync_runs WHERE company_id=%s ORDER BY id DESC LIMIT 1", (company_id,))
        return cur.fetchone()


def test_unchanged_jobs_are_marked_seen_without_rewriting(test_company, monkeypatch):
    board = [job("a"), job("b"), job("c")]
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard(board))
    first = sync.sync_company(test_company)
    assert first["created"] == 3
    before = rows(test_company.id)

    # next run: a unchanged, b retitled, c gone
    board[:] = [job("a"), job("b", "Senior Job b")]
    second = sync.sync_company(test_company)
    after = rows(test_company.id)
    run = last_run(test_company.id)

    assert (second["unchanged"], second["updated"], second["created"], second["closed"]) == (1, 1, 0, 1)
    assert after["a"]["last_seen_run"] == run["id"]                 # bulk "seen" update
    assert after["a"]["updated_at"] == before["a"]["updated_at"]    # but not rewritten
    assert after["b"]["title"] == "Senior Job b"
    assert after["c"]["closed_at"] is not None
    assert run["status"] == "ok" and run["notes"]["unchanged"] == 1


def test_a_fetch_error_is_recorded_and_changes_no_jobs(test_company, monkeypatch):
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard([job("a")]))
    sync.sync_company(test_company)

    class Broken(FakeBoard):
        def fetch_listings(self, company, with_content=False):
            raise RuntimeError("upstream 503")

    monkeypatch.setattr(connectors, "get", lambda ats: Broken([]))
    result = sync.sync_company(test_company)
    assert result["status"] == "error" and "503" in result["error"]
    assert rows(test_company.id)["a"]["closed_at"] is None
    with cursor() as cur:
        cur.execute("SELECT consecutive_failures, last_error FROM companies WHERE id=%s", (test_company.id,))
        company = cur.fetchone()
    assert company["consecutive_failures"] == 1 and "503" in company["last_error"]


def test_an_empty_board_does_not_close_everything(test_company, monkeypatch):
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard([job(str(i)) for i in range(8)]))
    sync.sync_company(test_company)
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard([]))
    result = sync.sync_company(test_company)
    assert result["status"] == "suspicious" and result["closed"] == 0
    assert all(r["closed_at"] is None for r in rows(test_company.id).values())


def test_due_picks_active_boards_hourly_and_quiet_ones_every_few_hours(test_company, monkeypatch):
    def set_synced(ago: timedelta):
        with cursor(commit=True) as cur:
            cur.execute("UPDATE companies SET last_synced_at=now() - %s WHERE id=%s", (ago, test_company.id))

    def is_due() -> bool:
        return test_company.id in {c.id for c in sync.load_companies(only=test_company.board_token, due=True)}

    assert is_due()                       # never synced
    set_synced(timedelta(hours=2))
    assert not is_due()                   # no open jobs: quiet, 2h is too soon
    set_synced(timedelta(hours=7))
    assert is_due()                       # quiet board, 7h: due

    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard([job("a")]))
    sync.sync_company(test_company)       # now it has an open job
    set_synced(timedelta(minutes=20))
    assert not is_due()                   # active, checked 20 min ago
    set_synced(timedelta(minutes=55))
    assert is_due()                       # active, ~an hour ago: due


def test_download_happens_with_no_database_connection(test_company, monkeypatch):
    seen = []

    class Watching(FakeBoard):
        def fetch_listings(self, company, with_content=False):
            seen.append(db._pool)  # None means every connection was closed
            return self.jobs

    monkeypatch.setattr(connectors, "get", lambda ats: Watching([job("a")]))
    # keep the end-of-run prune to this test's company, never the real dev data
    real_prune = sync.prune
    monkeypatch.setattr(sync, "prune", lambda cutoff=None: real_prune(cutoff, company_id=test_company.id))
    results, _ = sync.sync_all(only=test_company.board_token)
    assert seen == [None]
    assert results[0]["created"] == 1 and "a" in rows(test_company.id)


def test_first_sync_time_is_recorded_once(test_company, monkeypatch):
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard([job("a")]))

    def first_synced():
        with cursor() as cur:
            cur.execute("SELECT first_synced_at FROM companies WHERE id=%s", (test_company.id,))
            return cur.fetchone()["first_synced_at"]

    sync.sync_company(test_company)
    first = first_synced()
    assert first is not None
    sync.sync_company(test_company)
    assert first_synced() == first


def test_prune_drops_old_sync_logs(test_company, monkeypatch):
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard([job("a")]))
    sync.sync_company(test_company)
    with cursor(commit=True) as cur:
        cur.execute("UPDATE sync_runs SET started_at = now() - interval '5 days' WHERE company_id=%s",
                    (test_company.id,))
    sync.sync_company(test_company)  # a fresh log row
    sync.prune(company_id=test_company.id)
    with cursor() as cur:
        cur.execute("SELECT count(*) n FROM sync_runs WHERE company_id=%s", (test_company.id,))
        assert cur.fetchone()["n"] == 1


def test_new_jobs_record_when_the_board_was_last_checked(test_company, monkeypatch):
    def checked_before():
        with cursor() as cur:
            cur.execute("SELECT external_id, board_checked_before FROM jobs WHERE company_id=%s",
                        (test_company.id,))
            return {r["external_id"]: r["board_checked_before"] for r in cur.fetchall()}

    board = [job("a")]
    monkeypatch.setattr(connectors, "get", lambda ats: FakeBoard(board))
    sync.sync_company(test_company)
    assert checked_before() == {"a": None}           # first sync: nothing to compare with

    with cursor() as cur:
        cur.execute("SELECT last_success_at FROM companies WHERE id=%s", (test_company.id,))
        previous = cur.fetchone()["last_success_at"]
    board[:] = [job("a", "Retitled"), job("b")]
    sync.sync_company(test_company)
    after = checked_before()
    assert after["b"] == previous                    # appeared after that check
    assert after["a"] is None                        # an update never sets it
