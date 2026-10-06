"""Pay range extraction from description text.

Ashby and Lever have a structured pay field; Greenhouse only has the posting
text, where US (and more and more EU) pay transparency rules mean about a third
of postings state a range: "$120,000 - $150,000 USD per year", "£50k-£60k",
"$31.52 - $40.98/hr".

Precision matters more than recall: a wrong salary on a listing is worse than
none. So a range needs a currency and both ends plausible for its period, and a
single figure ("$100,000 base") only counts right after a word like "salary".
Funding rounds ("$40M Series B") and revenue never match, because millions
aren't plausible pay.
"""
from __future__ import annotations

import re

# 120,000 | 45.000 (European) | 120k | 31.52
AMOUNT = r"\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:\.\d{3})+(?![\d,])|\d+(?:\.\d+)?\s?[kK]\b|\d+(?:\.\d{1,2})?"
# Symbol or code in front: $, US$, CA$, C$, A$, £, €, or "USD 120,000".
PREFIX = r"(?:US|CA|C|A|AU|NZ|S|SG)?\$|£|€|\b(?:USD|CAD|EUR|GBP|AUD)\s?"
CODE = r"USD|CAD|EUR|GBP|AUD|NZD|SGD|CHF|PLN|INR"

RANGE_RE = re.compile(
    rf"(?P<cur1>{PREFIX})\s?(?P<lo>{AMOUNT})(?:\s?(?:{CODE})\b)?"
    rf"\s*(?:-|–|—|\bto\b|\band\b)\s*"
    rf"(?P<cur2>{PREFIX})?\s?(?P<hi>{AMOUNT})"
    rf"(?:\s?(?P<code>{CODE})\b)?",
)
SINGLE_RE = re.compile(
    rf"\b(?:salary|base pay|base|pay|compensation|wage)\b(?P<gap>[^.$£€\d+]{{0,30}})"
    rf"(?P<cur1>{PREFIX})\s?(?P<lo>{AMOUNT})(?:\s?(?P<code>{CODE})\b)?",
    re.I,
)

HOUR_RE = re.compile(r"^\W{0,3}(?:/\s?(?:hr|hour)|per\s+hour|an\s+hour|hourly|ph\b)", re.I)
MONTH_RE = re.compile(r"^\W{0,3}(?:/\s?(?:mo|month)|per\s+month|a\s+month|monthly)", re.I)
HOURLY_BEFORE_RE = re.compile(r"\bhourly\b[^.$]{0,20}$", re.I)
# "$65 - $75 per point / per visit / per shift": a rate for something else.
PER_OTHER_RE = re.compile(r"^\W{0,3}per\s+(?!hour|year|annum|yr|hr|month)", re.I)

# What counts as believable pay for each period; anything outside is some other
# number (funding, revenue, a bonus, a typo).
PLAUSIBLE = {"year": (15_000, 1_500_000), "month": (1_000, 120_000), "hour": (8, 500)}

SYMBOLS = {"£": "GBP", "€": "EUR", "US$": "USD", "CA$": "CAD", "C$": "CAD",
           "A$": "AUD", "AU$": "AUD", "NZ$": "NZD", "S$": "SGD", "SG$": "SGD"}
# Which dollar a bare "$" means, by the job's country.
DOLLARS = {"CA": "CAD", "AU": "AUD", "NZ": "NZD", "SG": "SGD"}

# Only the first part of a long description: pay is in the body or right after
# it, while what follows tends to be benefits, legal text, other roles.
SCAN_CHARS = 20_000


def _number(text: str) -> float:
    text = text.replace(",", "").strip()
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", text):  # European thousands
        text = text.replace(".", "")
    if text[-1] in "kK":
        return float(text[:-1].strip()) * 1000
    return float(text)


def _currency(prefix: str | None, code: str | None, country: str | None) -> str:
    if code:
        return code.upper()
    prefix = (prefix or "").strip()
    if prefix in SYMBOLS:
        return SYMBOLS[prefix]
    if prefix.isalpha():
        return prefix.upper()
    return DOLLARS.get(country or "", "USD")


def _period(text: str, start: int, end: int, lo: float) -> str | None:
    after = text[end:end + 25]
    if PER_OTHER_RE.search(after):
        return None
    if HOUR_RE.search(after) or HOURLY_BEFORE_RE.search(text[max(0, start - 30):start]):
        return "hour"
    if MONTH_RE.search(after):
        return "month"
    # No unit: small numbers can only be hourly, big ones yearly.
    if lo >= PLAUSIBLE["year"][0]:
        return "year"
    if lo <= PLAUSIBLE["hour"][1]:
        return "hour"
    return None


def _plausible(period: str | None, lo: float, hi: float) -> bool:
    if period is None:
        return False
    low, high = PLAUSIBLE[period]
    # A real range rarely spans more than about 3x.
    return low <= lo <= hi <= high and hi <= lo * 3.5


def from_text(text: str | None, country: str | None = None) -> dict | None:
    """Return {comp_min, comp_max, comp_currency, comp_period}, or None."""
    if not text:
        return None
    head = text[:SCAN_CHARS]

    for m in RANGE_RE.finditer(head):
        lo, hi = _number(m["lo"]), _number(m["hi"])
        # "$120 - 150K": the k on the top end applies to both.
        if m["hi"].strip()[-1] in "kK" and m["lo"].strip()[-1] not in "kK" and lo < 1000:
            lo *= 1000
        period = _period(head, m.start(), m.end(), lo)
        if _plausible(period, lo, hi):
            return {"comp_min": lo, "comp_max": hi,
                    "comp_currency": _currency(m["cur1"], m["code"], country),
                    "comp_period": period}

    for m in SINGLE_RE.finditer(head):
        if "OTE" in m["gap"]:  # on-target earnings include commission: not pay
            continue
        lo = _number(m["lo"])
        period = _period(head, m.start("lo"), m.end(), lo)
        if _plausible(period, lo, lo):
            return {"comp_min": lo, "comp_max": lo,
                    "comp_currency": _currency(m["cur1"], m["code"], country),
                    "comp_period": period}
    return None


# The ATS fields' own names for a period.
ASHBY_INTERVALS = {"1 YEAR": "year", "1 MONTH": "month", "1 HOUR": "hour"}
LEVER_INTERVALS = {"per-year-salary": "year", "per-month-salary": "month", "per-hour-wage": "hour"}
