"""Location normalization — the messy real-world strings these APIs actually emit.

Every case here was observed in live data during development.
"""
import pytest

from jobsite.locations import normalize, split_locations


@pytest.mark.parametrize(
    "raw,expected",
    [
        # Greenhouse writes multi-city lists with commas...
        ("Seattle, San Francisco, New York City",
         ["Seattle", "San Francisco", "New York City"]),
        # ...but also writes a single place the same way. Must not split.
        ("Seattle, WA", ["Seattle, WA"]),
        ("Cambridge, UK", ["Cambridge, UK"]),
        # Greenhouse also uses bullets as separators.
        ("San Francisco, CA • New York, NY • United States",
         ["San Francisco, CA", "New York, NY", "United States"]),
        ("San Francisco, CA; New York, NY", ["San Francisco, CA", "New York, NY"]),
        # Null markers are not places.
        ("N/A", []),
        # Workday's useless placeholder.
        ("6 Locations", []),
        ("Hybrid", []),
    ],
)
def test_split(raw, expected):
    assert split_locations(raw) == expected


@pytest.mark.parametrize(
    "raw,country,region",
    [
        ("Seattle, WA", "US", "US"),
        ("London, UK", "GB", "UK"),
        ("Bengaluru, India", "IN", "APAC"),
        ("Colombo", "LK", "APAC"),
        ("Belgrade, Serbia", "RS", "EU"),
        # Workday-style code prefixes.
        ("US-CA-Menlo Park", "US", "US"),
        ("GB-London", "GB", "UK"),
        # Office/HQ suffixes must not block the lookup.
        ("San Francisco HQ", "US", "US"),
        ("New York City Office", "US", "US"),
        ("San Francisco Bay Area", "US", "US"),
        # Supranational: region known, country genuinely unknown.
        ("Remote - European Union", None, "EU"),
    ],
)
def test_country_region(raw, country, region):
    got = normalize(raw)
    assert got["country"] == country
    assert got["region"] == region


def test_remote_detection():
    assert normalize("Remote")["remote"] is True
    assert normalize("Remote - US")["remote"] is True
    assert normalize("Seattle, WA")["remote"] is False


def test_hybrid_is_not_remote():
    """Ashby sets isRemote=true on Hybrid roles; hybrid must not be filed as remote."""
    got = normalize("Hybrid - Colombo", None)
    assert got["remote"] is False
    assert got["remote_scope"] == "hybrid"


def test_ats_flag_wins_over_text():
    """When the ATS states remoteness, trust it over regex guessing."""
    assert normalize("San Francisco", True)["remote"] is True
    assert normalize("Remote-ish office", False)["remote"] is False


def test_remote_scope():
    assert normalize("Remote", True)["remote_scope"] == "global"
    assert normalize("Remote (US)", True)["remote_scope"] == "country"
    assert normalize("Remote - APAC", True)["remote_scope"] == "region"


def test_empty_input():
    got = normalize(None)
    assert got["locations"] == [] and got["country"] is None
