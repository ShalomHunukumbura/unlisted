"""Slug variants and careers-URL parsing (pure functions; no network)."""
from jobsite.discovery import parse_url, slug_variants


def test_slug_variants():
    assert "acmecorp" in slug_variants("Acme Corp")
    assert "acme-corp" in slug_variants("Acme Corp")
    # Ashby board names often keep the company's own capitalization.
    assert "AcmeCorp" in slug_variants("Acme Corp")


def test_slug_variants_strips_suffixes():
    assert "acme" in slug_variants("Acme Inc")


def test_slug_variants_dedupes():
    v = slug_variants("Stripe")
    assert len(v) == len(set(v))


def test_parse_url_shapes(monkeypatch):
    """URL -> (ats, token) without hitting the network."""
    import jobsite.discovery as d

    class FakeConn:
        def validate_token(self, token, config=None):
            from jobsite.connectors.base import ValidationResult
            return ValidationResult(ok=True, job_count=1)

    monkeypatch.setattr(d.connectors, "get", lambda ats: FakeConn())

    cases = [
        ("https://boards.greenhouse.io/figma", "greenhouse", "figma"),
        ("https://job-boards.greenhouse.io/stripe", "greenhouse", "stripe"),
        ("https://jobs.ashbyhq.com/notion", "ashby", "notion"),
        ("https://jobs.lever.co/palantir", "lever", "palantir"),
        ("https://boards.greenhouse.io/embed/job_board?for=acme", "greenhouse", "acme"),
    ]
    for url, ats, token in cases:
        m = parse_url(url)
        assert m is not None, url
        assert (m.ats, m.token) == (ats, token)


def test_parse_url_detects_eu_region(monkeypatch):
    import jobsite.discovery as d

    class FakeConn:
        def validate_token(self, token, config=None):
            from jobsite.connectors.base import ValidationResult
            return ValidationResult(ok=True, job_count=1)

    monkeypatch.setattr(d.connectors, "get", lambda ats: FakeConn())
    m = parse_url("https://jobs.eu.lever.co/acme")
    assert m.config == {"region": "eu"}


def test_parse_url_rejects_unknown():
    assert parse_url("https://example.com/careers") is None
