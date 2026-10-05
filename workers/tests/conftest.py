"""Shared helpers. Database tests use the dev database and skip when it isn't running."""
import pytest

from jobsite.models import Company


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


