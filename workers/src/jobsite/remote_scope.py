"""Where a remote job is actually open to.

`remote = true` is not enough to know whether you can apply. "Remote - Portugal"
and "Remote: United States" are remote *and* geographically restricted; from
Sri Lanka they are unreachable. This module answers a narrower question:

    open_to = 'anywhere'  no geographic restriction stated
              'region'    restricted to a multi-country region (EU, APAC, LATAM…)
              'country'   restricted to one country
              NULL        not remote, or we could not tell

The default is deliberately pessimistic: when a remote job names *any* place we
recognize, it is treated as restricted. Showing a job you cannot apply to wastes
your time; hiding a vague one only costs a little recall.
"""
from __future__ import annotations

import re

from .locations import PLACES, US_STATES, lookup_place, split_locations

# Phrases that positively assert no restriction.
ANYWHERE_RE = re.compile(
    r"\b(anywhere(?:\s+in\s+the\s+world)?|worldwide|world\s*wide|global(?:ly)?"
    r"|fully\s+remote|remote\s*-?\s*global|distributed|any\s+location"
    r"|location\s+(?:independent|agnostic)|work\s+from\s+anywhere)\b",
    re.I,
)

# A bare remote marker with nothing else attached.
BARE_REMOTE_RE = re.compile(
    r"^[\s\-–—:,()]*(?:100%\s*)?(?:fully\s+)?remote(?:\s*[-–—:,]?\s*(?:first|only|ok|friendly))?"
    r"[\s\-–—:,()]*$",
    re.I,
)

# "Remote (US only)", "US-based", "must reside in", "authorized to work in"
RESTRICTION_RE = re.compile(
    r"\b(only|based|residents?|reside|located|authoriz|eligible|must\s+live"
    r"|work\s+authorization|time\s*zones?)\b",
    re.I,
)

REGION_NAMES = {
    "eu", "europe", "european union", "emea", "apac", "asia", "asia pacific",
    "latam", "latin america", "americas", "north america", "south america",
    "africa", "middle east", "anz", "nordics", "benelux", "dach", "global south",
}


def classify(location_raw: str | None, remote: bool,
             country: str | None = None, region: str | None = None) -> str | None:
    """Return 'anywhere' | 'region' | 'country' | None for a remote job."""
    if not remote:
        return None

    text = (location_raw or "").strip()

    # No location at all, or a bare "Remote" marker → unrestricted.
    if not text or BARE_REMOTE_RE.match(text):
        return "anywhere"

    lowered = text.lower()

    # A named country or region always wins over an "anywhere" word: phrases
    # like "Argentina - Fully Remote" or "Canada - Remote (ON, AB, BC only)"
    # contain both, and the named place is the real constraint.
    if country:
        return "country"

    # Try dash-separated segments too: "Argentina - Fully Remote" splits into
    # "Argentina - Fully", which matches nothing, so the country would be
    # missed and the job wrongly called unrestricted.
    candidates: list[str] = []
    for part in split_locations(text):
        candidates.append(part)
        for seg in re.split(r"\s*[-–—:]\s*", part):
            seg = seg.strip()
            if seg and seg not in candidates:
                candidates.append(seg)

    for part in candidates:
        key = part.lower().strip()
        if key in REGION_NAMES:
            return "region"
        hit = lookup_place(part)
        if hit:
            hit_country, _ = hit
            return "country" if hit_country else "region"
        # Bare US state names/codes ("California", "Texas", "GA") are US-only.
        if part.upper() in US_STATES or key in PLACES:
            return "country"

    if lowered in REGION_NAMES:
        return "region"
    if region:
        return "region"

    # Last resort before trusting an "anywhere" phrase: scan the raw text for
    # any known place name. Catches wordings our splitter misses, such as
    # "Anywhere in Belgium" or "Open to candidates across Kenya".
    tokens = re.findall(r"[a-z]+", lowered)
    grams: list[str] = []
    for n in (3, 2, 1):                     # longest first: "united states" > "states"
        grams += [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]
    for w in grams:
        if w in REGION_NAMES:
            return "region"
        if w in PLACES:
            place_country, _ = PLACES[w]
            return "country" if place_country else "region"

    # Explicit unrestricted wording, with no place named above.
    if ANYWHERE_RE.search(text):
        return "anywhere"

    # Mentions eligibility/residency but named nothing we recognize: assume
    # restricted rather than promising something we cannot verify.
    if RESTRICTION_RE.search(text):
        return "country"

    # Something unrecognized is attached to the remote marker. Pessimistic.
    return "country"
