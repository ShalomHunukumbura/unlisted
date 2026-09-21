"""Where a remote job is open to.

The stakes are asymmetric: showing a job you cannot apply to wastes real time,
while hiding a vague one only costs a little recall. So the classifier is
pessimistic, and the false-positive cases below are the ones that matter.
Every string here was observed in live data.
"""
import pytest

from jobsite.locations import normalize
from jobsite.remote_scope import classify


def scope(raw: str, remote: bool = True) -> str | None:
    loc = normalize(raw, remote)
    return classify(raw, remote, loc["country"], loc["region"])


@pytest.mark.parametrize("raw", [
    "Remote", "remote", "Remote, Global", "Remote - Global", "Remote (Global)",
    "Global", "Global, Remote", "Distributed", "Anywhere", "Any Location",
    "Worldwide", "Remote - Worldwide", "Fully Remote", "100% Remote",
    "Remote-first", "",
])
def test_unrestricted(raw):
    assert scope(raw) == "anywhere"


@pytest.mark.parametrize("raw", [
    "Remote - Portugal",
    "Remote: United States",
    "Canada - Remote (ON, AB, BC, or NS Only)",
    "Remote (US only)",
    "Remote - India",
    # A country named alongside "fully remote" is still a restriction.
    "Argentina - Fully Remote",
    "Ecuador - Fully Remote",
    # "Anywhere" is not unrestricted when a place follows it.
    "Anywhere in Belgium",
    "Anywhere in the United States",
    # Bare US states are US-only.
    "California", "Texas",
    "Metro Manila",
    "Berlin Metropolitain Area",
    "Remote - US: Select locations",
])
def test_country_restricted(raw):
    assert scope(raw) == "country", f"{raw!r} must not read as unrestricted"


@pytest.mark.parametrize("raw", [
    "Remote - European Union", "Europe", "APAC", "LatAm", "Americas",
    "EMEA", "Remote - APAC",
])
def test_region_restricted(raw):
    assert scope(raw) == "region"


def test_not_remote_has_no_scope():
    assert scope("San Francisco, CA", remote=False) is None
    assert scope("Remote", remote=False) is None


def test_unrecognized_text_is_pessimistic():
    """Something attached to the remote marker that we cannot parse is treated
    as a restriction rather than promising the user it's open."""
    assert scope("Remote - Zzyzx Province") == "country"
