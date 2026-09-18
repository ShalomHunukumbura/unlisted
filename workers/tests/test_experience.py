"""Experience inference.

No ATS supplies this, so it is parsed from description text with a title
fallback. The false-positive cases below are the ones that matter: a wrong
number is worse than no number, because it silently mis-files a job.
"""
import pytest

from jobsite.experience import from_description, from_title, infer


@pytest.mark.parametrize(
    "text,expected",
    [
        ("We want 5+ years of experience.", (5, None)),
        ("Requires 3-5 years of experience", (3, 5)),
        ("3 to 7 years of relevant experience", (3, 7)),
        ("8+ yrs experience", (8, None)),
        ("2 or more years of experience", (2, None)),
        ("You have 4 years of professional experience", (4, None)),
        # Ranges beat plus-forms: more specific.
        ("2-4 years experience; 10+ years preferred", (2, 4)),
        # Several requirements -> the lowest is the real bar.
        ("8+ years engineering, 3+ years with Kubernetes", (3, None)),
    ],
)
def test_from_description(text, expected):
    assert from_description(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "We were founded 10 years ago.",          # company age
        "Serving customers for 20 years",          # marketing copy
        "Unlimited PTO and great benefits",        # no signal
        "",
        None,
    ],
)
def test_description_false_positives(text):
    """A wrong number is worse than none — these must not produce a range."""
    assert from_description(text) is None


def test_implausible_years_rejected():
    assert from_description("Over 40 years of industry leadership") is None


def test_only_scans_the_head():
    """Requirements appear early; later text is mostly boilerplate."""
    text = "Requirements: strong communication. " + ("filler " * 3000) + "5+ years"
    assert from_description(text) is None


@pytest.mark.parametrize(
    "title,expected",
    [
        ("Software Engineering Intern", (0, 1)),
        ("New Grad Software Engineer", (0, 1)),
        ("Junior Developer", (0, 2)),
        ("Senior Software Engineer", (5, None)),
        ("Staff Engineer", (8, None)),
        ("Principal Engineer", (8, None)),
        ("Director of Engineering", (10, None)),
        ("VP of Product", (10, None)),
        ("Software Engineer", None),   # unmarked mid-level: genuinely unknown
    ],
)
def test_from_title(title, expected):
    assert from_title(title) == expected


def test_description_wins_over_title():
    """A stated requirement beats a guess from the title."""
    got = infer("Senior Engineer", "We need 2+ years of experience.")
    assert (got["exp_min_years"], got["exp_source"]) == (2, "description")


def test_title_fallback_when_no_years_stated():
    got = infer("Staff Engineer", "Build great things.")
    assert (got["exp_min_years"], got["exp_source"]) == (8, "title")


def test_unknown_stays_unknown():
    got = infer("Software Engineer", "Join our team.")
    assert got["exp_min_years"] is None
    assert got["exp_source"] is None
