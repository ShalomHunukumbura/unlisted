"""Connector normalization, against payloads captured from the live APIs.

Fixtures keep these tests offline and fast; connectors touch no database, which
is what makes this possible.
"""
import json
from pathlib import Path

import pytest

from jobsite import connectors
from jobsite.models import Company

FIXTURES = Path(__file__).parent / "fixtures"


def load(ats: str) -> list[dict]:
    return json.loads((FIXTURES / f"{ats}.json").read_text())


@pytest.mark.parametrize("ats", ["greenhouse", "ashby", "lever"])
def test_normalize_produces_required_fields(ats):
    conn = connectors.get(ats)
    company = Company(id=1, name=ats, ats=ats, board_token=ats)
    for raw in load(ats):
        job = conn.normalize(company, raw)
        assert job.external_id, "external_id is the dedup key; must never be empty"
        assert job.title
        assert job.apply_url.startswith("http")
        assert job.content_hash()


@pytest.mark.parametrize("ats", ["greenhouse", "ashby", "lever"])
def test_descriptions_are_sanitized(ats):
    conn = connectors.get(ats)
    company = Company(id=1, name=ats, ats=ats, board_token=ats)
    for raw in load(ats):
        job = conn.normalize(company, raw)
        if job.description_html:
            assert "<script" not in job.description_html.lower()
            assert "onerror=" not in job.description_html.lower()


def test_content_hash_is_stable_and_sensitive():
    conn = connectors.get("ashby")
    company = Company(id=1, name="a", ats="ashby", board_token="a")
    raw = load("ashby")[0]

    first = conn.normalize(company, raw).content_hash()
    assert first == conn.normalize(company, raw).content_hash(), "must be deterministic"

    changed = dict(raw, title=raw["title"] + " (Senior)")
    assert conn.normalize(company, changed).content_hash() != first


def test_ashby_hybrid_not_marked_remote():
    """Ashby reports isRemote=true on Hybrid roles; we must not trust it blindly."""
    conn = connectors.get("ashby")
    company = Company(id=1, name="a", ats="ashby", board_token="a")
    raw = dict(load("ashby")[0], isRemote=True, workplaceType="Hybrid")
    job = conn.normalize(company, raw)
    assert job.remote is False
    assert job.remote_scope == "hybrid"


def test_greenhouse_unescapes_content():
    """Greenhouse HTML-escapes `content` inside the JSON payload."""
    conn = connectors.get("greenhouse")
    company = Company(id=1, name="g", ats="greenhouse", board_token="g")
    raw = dict(load("greenhouse")[0],
               content="&lt;p&gt;Hello &lt;strong&gt;world&lt;/strong&gt;&lt;/p&gt;")
    job = conn.normalize(company, raw)
    assert "<strong>" in job.description_html
    assert job.description_text == "Hello world"


def test_registry_has_tier1():
    assert set(connectors.available()) >= {"greenhouse", "ashby", "lever"}
