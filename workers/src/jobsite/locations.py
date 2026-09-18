"""Location + remote normalization.

The goal is *filterable*, not *correct*. No geocoding, no geo database — that is
the trap here. A hand-maintained dict covers the overwhelming majority of tech
job locations. location_raw is always kept and always displayed; locations[] and
country/region exist only to drive filters.

To tune the dict, after a real sync run:
  SELECT location_raw, count(*) FROM jobs
   WHERE country IS NULL AND closed_at IS NULL
   GROUP BY 1 ORDER BY 2 DESC LIMIT 50;
"""
from __future__ import annotations

import re

REMOTE_RE = re.compile(
    r"\b(remote|remote-first|distributed|work\s*from\s*home|wfh|anywhere)\b", re.I
)
HYBRID_RE = re.compile(r"\bhybrid\b", re.I)

# US state codes -> US
US_STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
}

# city / country token -> (country, region)
PLACES: dict[str, tuple[str | None, str]] = {}


def _add(region: str, country: str, names: list[str]) -> None:
    for n in names:
        PLACES[n.lower()] = (country, region)


_add("US", "US", [
    "united states", "usa", "u.s.", "us", "san francisco", "sf", "bay area",
    "mountain view", "palo alto", "menlo park", "sunnyvale", "santa clara",
    "san jose", "oakland", "los angeles", "san diego", "seattle", "bellevue",
    "redmond", "portland", "denver", "boulder", "austin", "dallas", "houston",
    "chicago", "new york", "new york city", "nyc", "brooklyn", "boston",
    "cambridge", "washington", "arlington", "atlanta", "miami", "orlando",
    "phoenix", "salt lake city", "minneapolis", "detroit", "pittsburgh",
    "philadelphia", "raleigh", "durham", "charlotte", "nashville", "columbus",
])
_add("CA", "CA", [
    "canada", "toronto", "vancouver", "montreal", "ottawa", "waterloo", "calgary",
])
_add("UK", "GB", [
    "united kingdom", "uk", "england", "london", "manchester", "edinburgh",
    "cambridge, uk", "bristol", "leeds", "glasgow", "oxford",
])
# Supranational / vague regions: region known, country deliberately not.
PLACES.update({
    "european union": (None, "EU"), "eu": (None, "EU"), "europe": (None, "EU"),
    "emea": (None, "EU"), "apac": (None, "APAC"), "latam": (None, "LATAM"),
    "north america": (None, "US"), "americas": (None, "US"),
})

_add("EU", "IE", ["ireland", "dublin", "cork"])
_add("EU", "DE", ["germany", "berlin", "munich", "münchen", "hamburg", "frankfurt", "cologne"])
_add("EU", "FR", ["france", "paris", "lyon", "toulouse"])
_add("EU", "NL", ["netherlands", "amsterdam", "rotterdam", "utrecht", "the hague"])
_add("EU", "ES", ["spain", "madrid", "barcelona", "valencia"])
_add("EU", "PT", ["portugal", "lisbon", "porto"])
_add("EU", "IT", ["italy", "milan", "rome", "turin"])
_add("EU", "PL", ["poland", "warsaw", "krakow", "kraków", "wroclaw", "gdansk"])
_add("EU", "SE", ["sweden", "stockholm", "gothenburg"])
_add("EU", "NO", ["norway", "oslo"])
_add("EU", "DK", ["denmark", "copenhagen"])
_add("EU", "FI", ["finland", "helsinki"])
_add("EU", "CH", ["switzerland", "zurich", "zürich", "geneva", "lausanne"])
_add("EU", "AT", ["austria", "vienna"])
_add("EU", "BE", ["belgium", "brussels", "ghent"])
_add("EU", "CZ", ["czechia", "czech republic", "prague"])
_add("EU", "RO", ["romania", "bucharest", "cluj", "cluj-napoca"])
_add("EU", "GR", ["greece", "athens"])
_add("EU", "EE", ["estonia", "tallinn"])
_add("EU", "LT", ["lithuania", "vilnius"])
_add("EU", "HU", ["hungary", "budapest"])
_add("APAC", "IN", [
    "india", "bengaluru", "bangalore", "hyderabad", "mumbai", "pune", "delhi",
    "new delhi", "gurgaon", "gurugram", "noida", "chennai", "kolkata",
])
_add("APAC", "LK", ["sri lanka", "colombo", "kandy", "galle", "jaffna"])
_add("APAC", "SG", ["singapore"])
_add("APAC", "AU", ["australia", "sydney", "melbourne", "brisbane", "perth"])
_add("APAC", "NZ", ["new zealand", "auckland", "wellington"])
_add("APAC", "JP", ["japan", "tokyo", "osaka", "kyoto"])
_add("APAC", "KR", ["south korea", "korea", "seoul"])
_add("APAC", "CN", ["china", "beijing", "shanghai", "shenzhen", "hong kong"])
_add("APAC", "TW", ["taiwan", "taipei"])
_add("APAC", "PH", ["philippines", "manila", "cebu"])
_add("APAC", "ID", ["indonesia", "jakarta"])
_add("APAC", "VN", ["vietnam", "hanoi", "ho chi minh city"])
_add("APAC", "MY", ["malaysia", "kuala lumpur"])
_add("APAC", "TH", ["thailand", "bangkok"])
_add("APAC", "PK", ["pakistan", "karachi", "lahore", "islamabad"])
_add("APAC", "BD", ["bangladesh", "dhaka"])
_add("LATAM", "BR", ["brazil", "são paulo", "sao paulo", "rio de janeiro"])
_add("LATAM", "MX", ["mexico", "mexico city", "guadalajara", "méxico"])
_add("LATAM", "AR", ["argentina", "buenos aires"])
_add("LATAM", "CL", ["chile", "santiago"])
_add("LATAM", "CO", ["colombia", "bogota", "bogotá", "medellin", "medellín"])
_add("LATAM", "CR", ["costa rica", "san jose, costa rica"])
_add("LATAM", "UY", ["uruguay", "montevideo"])
_add("LATAM", "PE", ["peru", "lima"])
_add("MEA", "IL", ["israel", "tel aviv", "jerusalem", "herzliya"])
_add("MEA", "AE", ["uae", "dubai", "abu dhabi", "united arab emirates"])
_add("MEA", "ZA", ["south africa", "cape town", "johannesburg"])
_add("MEA", "NG", ["nigeria", "lagos", "abuja"])
_add("MEA", "KE", ["kenya", "nairobi"])
_add("MEA", "EG", ["egypt", "cairo"])
_add("MEA", "TR", ["turkey", "istanbul", "ankara"])
# Seen in real synced data.
_add("EU", "RS", ["serbia", "belgrade", "novi sad"])
_add("EU", "BG", ["bulgaria", "sofia"])
_add("EU", "UA", ["ukraine", "kyiv", "kiev"])
_add("EU", "HR", ["croatia", "zagreb"])
_add("US", "US", ["san francisco bay area", "menlo park", "bellevue", "sunnyvale"])
_add("APAC", "IN", ["gurgaon", "ahmedabad"])

SPLIT_RE = re.compile(r"\s*(?:;|\||/|•|·|\bor\b|\band\b)\s*", re.I)
# Noise that shows up glued onto real locations.
STRIP_RE = re.compile(
    r"\b(remote|hybrid|on-?site|in-?office|flexible|optional|based|multiple locations"
    r"|various locations|n/?a|\d+\+? locations)\b",
    re.I,
)
# Office/HQ suffixes that otherwise stop a city from matching.
SUFFIX_RE = re.compile(r"\s*\b(hq|head\s*office|office|campus|metro\s*area|area)\b\s*$", re.I)
# Workday-style "US-CA-Menlo Park" / "GB-London" prefixes.
CODE_PREFIX_RE = re.compile(r"^([A-Z]{2})-(?:([A-Z]{2})-)?(.+)$")


def _looks_like_qualifier(part: str) -> bool:
    """True when a comma-separated fragment qualifies the previous one rather than
    being its own place: 'Seattle, WA' / 'Cambridge, UK' vs a real list."""
    p = part.strip()
    if not p:
        return True
    if p.upper() in US_STATES:
        return True
    if len(p) <= 3:
        return True
    return p.lower() in PLACES and PLACES[p.lower()][0] in {"US", "UK", "CA"} and len(p.split()) == 1


def split_locations(raw: str) -> list[str]:
    """Split a free-text location into candidate places.

    Greenhouse writes lists as 'Seattle, San Francisco, New York City' but also
    writes single places as 'Seattle, WA' — so commas only split when the next
    fragment doesn't look like a state/country qualifier.
    """
    if not raw or raw.strip().lower() in {"n/a", "na", "none", "-", "tbd", "various"}:
        return []
    out: list[str] = []
    for chunk in SPLIT_RE.split(raw):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = [p.strip() for p in chunk.split(",")]
        buf = ""
        for part in parts:
            if not buf:
                buf = part
            elif _looks_like_qualifier(part):
                buf = f"{buf}, {part}"
            else:
                out.append(buf)
                buf = part
        if buf:
            out.append(buf)

    cleaned: list[str] = []
    for loc in out:
        loc = STRIP_RE.sub("", loc).strip(" ,-–—()").strip()
        if loc and loc.lower() not in {l.lower() for l in cleaned}:
            cleaned.append(loc)
    return cleaned


def lookup_place(name: str) -> tuple[str | None, str] | None:
    """(country, region) for a place name, trying the full string then its parts."""
    name = name.strip()

    # "US-CA-Menlo Park" / "GB-London": the leading code is authoritative.
    m = CODE_PREFIX_RE.match(name)
    if m:
        cc = m.group(1).upper()
        for key in (cc.lower(), m.group(3).lower()):
            if key in PLACES:
                return PLACES[key]

    if name.lower() in PLACES:
        return PLACES[name.lower()]
    key = SUFFIX_RE.sub("", name).lower().strip()
    if key in PLACES:
        return PLACES[key]
    parts = [p.strip() for p in key.split(",")]
    for part in reversed(parts):          # trailing country/state is most specific
        if part in PLACES:
            return PLACES[part]
        if part.upper() in US_STATES:
            return ("US", "US")
    return None


def normalize(raw: str | None, ats_remote: bool | None = None,
              title: str | None = None) -> dict:
    """Normalize a location string into filterable fields.

    ats_remote wins when the ATS reports it directly (Ashby does); otherwise we
    fall back to matching the raw text.
    """
    raw = (raw or "").strip() or None
    hay = " ".join(filter(None, [raw, title]))

    remote = bool(ats_remote) if ats_remote is not None else bool(REMOTE_RE.search(hay))
    remote_scope = None
    if HYBRID_RE.search(hay):
        remote_scope = "hybrid"
        if ats_remote is None:
            remote = False

    locations = split_locations(raw) if raw else []

    country = region = None
    for loc in locations:
        hit = lookup_place(loc)
        if hit:
            country, region = hit
            break  # first recognized place wins
    if country is None and raw:
        hit = lookup_place(raw)
        if hit:
            country, region = hit

    if remote and remote_scope is None:
        remote_scope = "region" if region and not country else ("country" if country else "global")

    return {
        "location_raw": raw,
        "locations": locations,
        "country": country,
        "region": region,
        "remote": remote,
        "remote_scope": remote_scope,
    }
