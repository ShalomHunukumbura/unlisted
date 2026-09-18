"""Experience-level inference.

No ATS exposes a structured experience field, so this is inferred — first from
explicit year requirements in the description (about 76% of jobs state one),
then falling back to seniority words in the title.

We store a [min_years, max_years] range rather than a single bucket, so the UI
can filter by overlap: someone filtering "3-5" should see a role asking for
"2-6 years" and an open-ended "5+ years" role too.

max_years is NULL for open-ended requirements ("5+ years").
"""
from __future__ import annotations

import re

# "3+ years", "5 or more years", "7 years of experience"
PLUS_RE = re.compile(
    r"(\d{1,2})\s*(?:\+|plus\b|or\s+more\b)\s*(?:years?|yrs?)\b", re.I
)
# "3-5 years", "3 to 5 years", "3–5 years"
RANGE_RE = re.compile(
    r"(\d{1,2})\s*(?:-|–|—|\bto\b)\s*(\d{1,2})\s*(?:\+\s*)?(?:years?|yrs?)\b", re.I
)
# Plain "5 years of experience" / "5 years' experience"
PLAIN_RE = re.compile(
    r"(\d{1,2})\s*(?:years?|yrs?)[\s'’]*(?:of\s+)?(?:relevant\s+|professional\s+|industry\s+|work\s+)?experience",
    re.I,
)

# Only look at the first part of a description: the requirements section is
# normally early, while later text ("5 years of company growth", benefits
# blurbs) produces false positives.
SCAN_CHARS = 6000

# A stated figure above this is almost always about something other than the
# candidate's experience (company age, customer counts).
MAX_PLAUSIBLE_YEARS = 25

TITLE_RULES: list[tuple[re.Pattern, tuple[int, int | None]]] = [
    (re.compile(r"\b(intern|internship|co-?op)\b", re.I), (0, 1)),
    (re.compile(r"\b(new\s?grad|university\s+grad|campus|apprentice)\b", re.I), (0, 1)),
    (re.compile(r"\b(entry[\s-]?level|junior|jr\.?)\b", re.I), (0, 2)),
    (re.compile(r"\b(chief|vp|vice\s+president|head\s+of|director)\b", re.I), (10, None)),
    (re.compile(r"\b(principal|distinguished|fellow)\b", re.I), (8, None)),
    (re.compile(r"\bstaff\b", re.I), (8, None)),
    (re.compile(r"\b(senior|sr\.?|lead)\b", re.I), (5, None)),
    (re.compile(r"\b(associate|assistant)\b", re.I), (0, 3)),
]


def from_description(text: str | None) -> tuple[int, int | None] | None:
    """Extract a [min, max] year range from description text, if stated."""
    if not text:
        return None
    head = text[:SCAN_CHARS]

    # A range is the most specific statement, so prefer it.
    for m in RANGE_RE.finditer(head):
        lo, hi = int(m.group(1)), int(m.group(2))
        if lo <= hi <= MAX_PLAUSIBLE_YEARS:
            return (lo, hi)

    candidates: list[int] = []
    for pattern in (PLUS_RE, PLAIN_RE):
        for m in pattern.finditer(head):
            years = int(m.group(1))
            if 0 < years <= MAX_PLAUSIBLE_YEARS:
                candidates.append(years)

    if not candidates:
        return None
    # Several requirements often appear ("5+ years engineering, 2+ years Go").
    # The smallest is the real entry bar.
    return (min(candidates), None)


def from_title(title: str | None) -> tuple[int, int | None] | None:
    """Fall back to seniority words in the title."""
    if not title:
        return None
    for pattern, span in TITLE_RULES:
        if pattern.search(title):
            return span
    return None


def infer(title: str | None, description_text: str | None) -> dict:
    """Return {min_years, max_years, source}.

    source is 'description' | 'title' | None, so the UI can distinguish a stated
    requirement from an inferred one.
    """
    span = from_description(description_text)
    if span:
        return {"exp_min_years": span[0], "exp_max_years": span[1],
                "exp_source": "description"}

    span = from_title(title)
    if span:
        return {"exp_min_years": span[0], "exp_max_years": span[1],
                "exp_source": "title"}

    return {"exp_min_years": None, "exp_max_years": None, "exp_source": None}
