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


@pytest.mark.parametrize("ats", ["greenhouse", "ashby", "lever", "recruitee"])
def test_normalize_produces_required_fields(ats):
    conn = connectors.get(ats)
    company = Company(id=1, name=ats, ats=ats, board_token=ats)
    for raw in load(ats):
        job = conn.normalize(company, raw)
        assert job.external_id, "external_id is the dedup key; must never be empty"
        assert job.title
        assert job.apply_url.startswith("http")
        assert job.content_hash()


@pytest.mark.parametrize("ats", ["greenhouse", "ashby", "lever", "recruitee"])
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


def test_recruitee_prefers_english_and_reads_structured_fields():
    conn = connectors.get("recruitee")
    company = Company(id=1, name="r", ats="recruitee", board_token="r")
    raw = load("recruitee")[0]
    job = conn.normalize(company, raw)
    assert job.title == raw["translations"]["en"]["title"]
    assert job.description_text.startswith("As Head of People")
    # The structured locations, in English, not the board's "Nederland".
    assert job.country == "NL"
    assert job.remote is False and job.remote_scope == "hybrid"
    assert (job.comp_min, job.comp_max, job.comp_currency, job.comp_period) == (5200, 6400, "EUR", "month")
    assert job.employment_type == "Full-time"
    assert job.posted_at.isoformat() == "2026-09-29T14:53:39+00:00"


def test_recruitee_country_from_code_when_name_is_localized():
    conn = connectors.get("recruitee")
    company = Company(id=1, name="r", ats="recruitee", board_token="r")
    raw = load("recruitee")[0]
    place = dict(raw["locations"][0], city="Goslar", country="Deutschland", country_code="DE")
    job = conn.normalize(company, dict(raw, locations=[place]))
    assert job.location_raw == "Goslar, Deutschland"
    assert (job.country, job.region) == ("DE", "EU")


def test_recruitee_remote_only_when_it_is_the_only_option():
    conn = connectors.get("recruitee")
    company = Company(id=1, name="r", ats="recruitee", board_token="r")
    raw = load("recruitee")[0]
    for flags, remote in [((True, False, False), True), ((True, True, True), False),
                          ((False, False, True), False)]:
        job = conn.normalize(company, dict(raw, **dict(zip(("remote", "hybrid", "on_site"), flags))))
        assert job.remote is remote, flags


def test_recruitee_keeps_untranslated_postings_and_skips_empty_pay():
    conn = connectors.get("recruitee")
    company = Company(id=1, name="r", ats="recruitee", board_token="r")
    raw = load("recruitee")[1]
    assert "en" not in raw["translations"]
    job = conn.normalize(company, dict(raw, salary={"min": None, "max": None, "period": None, "currency": "EUR"}))
    assert job.title == raw["title"]
    assert job.comp_currency is None or job.pay_from_text


def test_registry_has_tier1():
    assert set(connectors.available()) >= {"greenhouse", "ashby", "lever", "recruitee"}
