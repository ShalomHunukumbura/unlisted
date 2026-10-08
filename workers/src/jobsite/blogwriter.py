"""Weekly blog drafts, written by a model from Unlisted's own numbers.

Every Monday the blog workflow runs `jobsite blog-drafts`, which writes:

- the words above last week's report (web/content/reports/<monday>.md), and
- one topic post (web/content/blog/<date>-<slug>.md), rotating between remote
  roles open to APAC, a skill, a job title, and who hired most,

and the workflow opens a pull request with them: a person reads every post
before it's published.

The model (GitHub Models, free with the workflow's GITHUB_TOKEN) is given only
facts from the database, and three checks run on what comes back: links must
be to pages on the site, any number not in the facts is listed in the pull
request for a human to check, and the shape (title, description, chips) is
validated.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from .db import cursor

log = logging.getLogger(__name__)

ENDPOINT = "https://models.github.ai/inference/chat/completions"
# The larger model writes better; the small one is the fallback when the free
# tier's daily limit for the larger one is reached.
MODELS = ["openai/gpt-4.1", "openai/gpt-4.1-mini"]

STYLE = """House style for the Unlisted blog:
- Plain, specific, calm. Write like a person who reads job data every week, not like marketing.
- Short paragraphs. Sentence case headings. British spelling.
- Never use: elevate, seamless, unleash, delve, landscape, tapestry, game-changer, "in today's", "it's worth noting", "navigate".
- No exclamation marks. No em dashes or en dashes: use commas, colons or full stops.
- Every number you write must appear in the facts you're given. Don't calculate new ones,
  don't round them differently, don't add outside knowledge about companies or the economy.
- Links: only the URLs listed in the facts under "links", written as Markdown links with paths
  exactly as given (they start with /). No other links.
- Refer to the site as Unlisted. It reads company career pages (Greenhouse, Ashby, Lever)
  hourly and keeps roles from the past week. One "role" is one company and job title."""

FRESH = "COALESCE(j.posted_at, j.first_seen_at) > now() - interval '7 days' AND j.closed_at IS NULL"
APAC = (
    "j.remote AND (j.open_to = 'anywhere' OR (j.open_to = 'region' AND j.region = 'APAC') "
    "OR (j.open_to = 'country' AND j.country IN ('LK', 'IN')))"
)

# The same titles as the weekly report (web/src/lib/reports.ts), as tsquery,
# with the /roles page each has, if any.
TITLES = {
    "Software Engineer": ("software <-> engineer", "software-engineer"),
    "Data Engineer": ("data <-> engineer", "data-engineer"),
    "Data Scientist": ("data <-> scientist", "data-scientist"),
    "Data Analyst": ("data <-> analyst", "data-analyst"),
    "Machine Learning Engineer": ("machine <-> learning", "machine-learning-engineer"),
    "Product Manager": ("product <-> manager", "product-manager"),
    "Product Designer": ("product <-> designer", "product-designer"),
    "DevOps / SRE": ("devops | sre | (site <-> reliability)", "devops-engineer"),
    "Security Engineer": ("security <-> engineer", "security-engineer"),
    "Account Executive": ("account <-> executive", "account-executive"),
    "Customer Success": ("customer <-> success", "customer-success-manager"),
    "Engineering Manager": ("engineering <-> manager", "engineering-manager"),
    "Recruiter": ("recruiter", "recruiter"),
    "Registered Nurse": ("registered <-> nurse", None),
}
# Skills in the report, how to search for them, and their /roles page.
SKILLS = {
    "Python": ("python", "python"), "SQL": ("sql", None), "AWS": ("aws", None),
    "TypeScript": ("typescript", "typescript"), "React": ("react", "react"), "Java": ("java", "java"),
    "Kubernetes": ("kubernetes", "kubernetes"), "Go": ("golang", "golang"), "Rust": ("rust", "rust"),
    "Salesforce": ("salesforce", None),
}


# ---------------------------------------------------------------- facts

def _rows(sql: str, params: tuple = ()) -> list[dict]:
    with cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def reports(week: dt.date) -> tuple[dict | None, dict | None]:
    """The finished week's numbers and the week before's."""
    rows = {
        r["week"]: r["stats"]
        for r in _rows(
            "SELECT week, stats FROM weekly_reports WHERE week IN (%s, %s)",
            (week, week - dt.timedelta(days=7)),
        )
    }
    return rows.get(week), rows.get(week - dt.timedelta(days=7))


def roles_matching(condition: str, params: tuple = ()) -> dict:
    """Facts about the roles of the past 7 days that match a condition."""
    # Find them once (the condition may search every description), then work
    # from the ids: one posting per role, the newest.
    ids = [
        r["id"]
        for r in _rows(
            f"""SELECT DISTINCT ON (j.company_id, lower(j.title)) j.id FROM jobs j
                 WHERE {FRESH} AND ({condition})
                 ORDER BY j.company_id, lower(j.title), j.posted_at DESC NULLS LAST""",
            params,
        )
    ]
    params = (ids,)
    base = """
      SELECT j.id, j.company_id, j.title, j.location_raw, j.remote, j.open_to, j.region, j.country,
             j.comp_min, j.comp_max, j.comp_currency, j.comp_period, j.posted_at, j.first_seen_at,
             c.name AS company, c.slug
        FROM jobs j JOIN companies c ON c.id = j.company_id
       WHERE j.id = ANY(%s)"""
    totals = _rows(
        f"""WITH m AS ({base})
            SELECT count(*) AS roles, count(DISTINCT company_id) AS companies,
                   count(*) FILTER (WHERE remote) AS remote,
                   count(*) FILTER (WHERE remote AND open_to = 'anywhere') AS remote_anywhere,
                   count(*) FILTER (WHERE {APAC.replace('j.', '')}) AS open_to_sri_lanka
              FROM m""",
        params,
    )[0]
    companies = _rows(
        f"""WITH m AS ({base})
            SELECT min(company) AS name, slug, count(*) AS roles,
                   count(*) FILTER (WHERE remote) AS remote
              FROM m GROUP BY slug ORDER BY roles DESC, name LIMIT 8""",
        params,
    )
    countries = _rows(
        f"""WITH m AS ({base})
            SELECT country, count(*) AS roles FROM m WHERE country IS NOT NULL
             GROUP BY country ORDER BY roles DESC LIMIT 5""",
        params,
    )
    pay = _rows(
        f"""WITH m AS ({base})
            SELECT count(*) AS postings_with_pay,
                   round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (comp_min + COALESCE(comp_max, comp_min)) / 2) / 1000) AS median_k,
                   round(percentile_cont(0.25) WITHIN GROUP (ORDER BY (comp_min + COALESCE(comp_max, comp_min)) / 2) / 1000) AS p25_k,
                   round(percentile_cont(0.75) WITHIN GROUP (ORDER BY (comp_min + COALESCE(comp_max, comp_min)) / 2) / 1000) AS p75_k
              FROM m WHERE comp_period = 'year' AND comp_currency = 'USD' AND comp_min > 10000""",
        params,
    )[0]
    examples = _rows(
        f"""WITH m AS ({base})
            SELECT id, title, company, location_raw, remote, open_to, region, country
              FROM m ORDER BY COALESCE(posted_at, first_seen_at) DESC LIMIT 8""",
        params,
    )
    roles = totals["roles"] or 0
    return {
        **totals,
        "remote_percent": round(100 * totals["remote"] / roles) if roles else 0,
        "top_companies": [
            {"name": c["name"], "roles": c["roles"], "remote_roles": c["remote"], "page": f"/companies/{c['slug']}"}
            for c in companies
        ],
        "top_countries": countries,
        "pay_usd_a_year": pay if (pay["postings_with_pay"] or 0) >= 5 else None,
        "example_roles": [
            {
                "title": e["title"],
                "company": e["company"],
                "where": _where(e),
                "page": f"/jobs/{e['id']}",
            }
            for e in examples
        ],
    }


def _where(job: dict) -> str:
    if not job["remote"]:
        return job["location_raw"] or "location not stated"
    return {
        "anywhere": "remote, from anywhere",
        "region": f"remote, {job['region']} only",
        "country": f"remote, {job['country']} only",
    }.get(job["open_to"], "remote")


def _growth(now: list[dict], before: list[dict] | None, key: str) -> list[dict]:
    """Week-on-week change for each title or skill, biggest relative rise first (100+ roles)."""
    prev = {r[key]: r["roles"] for r in (before or [])}
    out = []
    for r in now:
        p = prev.get(r[key])
        change = round(100 * (r["roles"] - p) / p) if p else None
        out.append({key: r[key], "roles": r["roles"], "previous_week": p, "change_percent": change})
    return sorted(out, key=lambda r: (r["roles"] >= 100, r["change_percent"] or 0, r["roles"]), reverse=True)


# ---------------------------------------------------------------- topics

@dataclass
class Topic:
    kind: str
    category: str
    brief: str
    facts: dict
    links: list[str] = field(default_factory=list)


def pick_topic(week: dt.date, stats: dict, previous: dict | None) -> Topic:
    """One topic a week, in rotation, chosen from what moved."""
    kind = ["apac", "skill", "title", "companies"][week.isocalendar().week % 4]

    if kind == "apac":
        facts = roles_matching(APAC)
        return Topic(
            kind, "Remote",
            "Remote roles open to Sri Lanka and the rest of Asia-Pacific this week: who's hiring, "
            "for what, how many are open worldwide versus to APAC, and a few examples worth a look.",
            facts, ["/remote/sri-lanka", "/remote/anywhere", "/for-you"],
        )
    if kind == "skill":
        moved = _growth(stats.get("skills", []), (previous or {}).get("skills"), "skill")
        skill = moved[0]["skill"] if moved else "Python"
        query, page = SKILLS.get(skill, (skill.lower(), None))
        facts = roles_matching("j.search_tsv @@ plainto_tsquery('english', %s)", (query,))
        facts["skill"] = skill
        facts["week_on_week"] = next((m for m in moved if m["skill"] == skill), None)
        links = [f"/roles/{page}"] if page else []
        return Topic(
            kind, "Tech",
            f"Who's hiring for {skill} this week: which companies, how many roles are remote, "
            f"what they pay where stated, and how demand changed from last week.",
            facts, links + ["/remote", "/for-you"],
        )
    if kind == "title":
        moved = _growth(stats.get("titles", []), (previous or {}).get("titles"), "title")
        title = moved[0]["title"] if moved else "Software Engineer"
        query, page = TITLES.get(title, ("software <-> engineer", None))
        facts = roles_matching("to_tsvector('english', j.title) @@ to_tsquery('english', %s)", (query,))
        facts["job_title"] = title
        facts["week_on_week"] = next((m for m in moved if m["title"] == title), None)
        links = [f"/roles/{page}"] if page else []
        return Topic(
            kind, "Market",
            f"{title} roles this week: how many, who's hiring, how many are remote, pay where stated, "
            "and how it compares with last week.",
            facts, links + ["/remote", "/for-you"],
        )
    facts = {"top_companies": stats.get("topCompanies", [])[:6]}
    for c in facts["top_companies"]:
        c["page"] = f"/companies/{c['slug']}"
        c["titles"] = [
            r["title"].strip()
            for r in _rows(
                f"""SELECT DISTINCT ON (lower(j.title)) j.title FROM jobs j JOIN companies co ON co.id = j.company_id
                     WHERE {FRESH} AND co.slug = %s ORDER BY lower(j.title), j.posted_at DESC NULLS LAST LIMIT 6""",
                (c["slug"],),
            )
        ]
    return Topic(
        "companies", "Companies",
        "The companies that posted the most roles last week, what kinds of roles they're hiring for, "
        "and what that suggests about where they're growing. Stick to what the role titles show.",
        facts, [c["page"] for c in facts["top_companies"]] + ["/companies"],
    )


# ---------------------------------------------------------------- the model

def ask(system: str, user: str) -> dict:
    """One chat completion that answers in JSON."""
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN is not set (the workflow provides it, with models: read)")
    last_error: Exception | None = None
    for model in MODELS:
        try:
            r = httpx.post(
                ENDPOINT,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                },
                timeout=120,
            )
            r.raise_for_status()
            log.info("drafted with %s", model)
            return json.loads(r.json()["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, json.JSONDecodeError) as e:
            log.warning("%s failed: %s", model, e)
            last_error = e
    raise RuntimeError(f"every model failed: {last_error}")


# ---------------------------------------------------------------- checks

LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
NUMBER = re.compile(r"\$?\d[\d,]*(?:\.\d+)?[%K]?")


def keep_known_links(markdown: str, allowed: set[str]) -> tuple[str, list[str]]:
    """Unwrap any link that isn't to an allowed page on the site."""
    dropped: list[str] = []

    def fix(m: re.Match) -> str:
        if m.group(2) in allowed:
            return m.group(0)
        dropped.append(m.group(2))
        return m.group(1)

    return LINK.sub(fix, markdown), dropped


def _numbers_in(value) -> set[str]:
    """Every number in the facts, in the forms a writer might use."""
    out: set[str] = set()
    for raw in re.findall(r"\d+(?:\.\d+)?", json.dumps(value)):
        n = float(raw)
        out.update({raw, f"{n:,.0f}", f"{n:.0f}"})
        if n >= 1000:
            out.add(f"{n / 1000:.0f}K")
    return out


def unknown_numbers(markdown: str, facts) -> list[str]:
    """Numbers in a draft that the facts don't contain: listed in the PR for a person to check."""
    known = _numbers_in(facts)
    found = []
    for token in NUMBER.findall(LINK.sub(r"\1", markdown)):
        bare = token.lstrip("$").rstrip("%").replace(",", "")
        bare_k = bare.rstrip("K")
        if bare in known or bare_k in known or token.rstrip("%") in known or token.lstrip("$") in known:
            continue
        if len(bare_k) <= 1:  # "a 2-day", list numbers and the like
            continue
        found.append(token)
    return sorted(set(found))


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:70].rstrip("-")


# ---------------------------------------------------------------- drafts

@dataclass
class Draft:
    path: Path
    title: str
    notes: list[str]


def draft_commentary(week: dt.date, stats: dict, previous: dict | None, content: Path) -> Draft | None:
    path = content / "reports" / f"{week.isoformat()}.md"
    if path.exists():
        log.info("%s exists, leaving it alone", path)
        return None
    share = lambda s: round(100 * s["remote"] / s["roles"]) if s and s.get("roles") else None  # noqa: E731
    facts = {
        "this_week": stats,
        "previous_week": previous,
        "remote_percent_this_week": share(stats),
        "remote_percent_previous_week": share(previous),
        "roles_change_percent": round(100 * (stats["roles"] - previous["roles"]) / previous["roles"])
        if previous and previous.get("roles") else None,
        "skills_week_on_week": _growth(stats.get("skills", []), (previous or {}).get("skills"), "skill"),
        "titles_week_on_week": _growth(stats.get("titles", []), (previous or {}).get("titles"), "title"),
        "links": ["/remote/sri-lanka", "/remote", "/for-you"],
    }
    answer = ask(
        STYLE,
        "Write the short introduction that goes above this week's hiring report on the Unlisted blog. "
        "Below it, readers see charts of all these numbers, so don't list them all: pick the two or "
        "three things that stood out (a change from last week, who hired most, remote roles, pay) and "
        "say plainly what they mean for someone looking for a job. 2 or 3 short paragraphs, no headings. "
        'Answer as JSON: {"markdown": "..."}.\n\nFacts:\n' + json.dumps(facts, default=str),
    )
    body, dropped = keep_known_links(str(answer.get("markdown", "")).strip(), set(facts["links"]))
    if len(body) < 200:
        raise RuntimeError("the commentary came back empty or too short")
    notes = [f"Removed a link to `{d}`" for d in dropped]
    notes += [f"Number not in the data: **{n}**" for n in unknown_numbers(body, facts)]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body + "\n")
    return Draft(path, f"Report commentary, week of {week.isoformat()}", notes)


def draft_topic_post(week: dt.date, stats: dict, previous: dict | None, content: Path, today: dt.date) -> Draft:
    topic = pick_topic(week, stats, previous)
    facts = {**topic.facts, "links": topic.links}
    answer = ask(
        STYLE,
        f"Write this week's topic post for the Unlisted blog.\n\nTopic: {topic.brief}\n\n"
        "500 to 800 words. Open with the most interesting fact, not with a definition. Use two to four "
        "## headings. Mention specific companies and example roles from the facts, linking their pages. "
        "End with one short paragraph pointing readers to the relevant links (for example, following a "
        "search or setting up For you). The title should be specific and plain (no colon-subtitle "
        "clickbait), under 80 characters. The description is one or two sentences for search results. "
        "Chips are 2 or 3 short labels (under 22 characters each) drawn on the banner, e.g. company "
        'names or "Remote · APAC".\n\n'
        'Answer as JSON: {"title": "...", "description": "...", "chips": ["..."], "markdown": "..."}.\n\n'
        "Facts:\n" + json.dumps(facts, default=str),
    )
    title = str(answer.get("title", "")).strip().strip('"')[:90]
    description = str(answer.get("description", "")).strip()[:240]
    raw_chips = answer.get("chips") if isinstance(answer.get("chips"), list) else []
    chips = [str(c)[:24] for c in raw_chips if str(c).strip()][:3]
    body = re.sub(r"^#\s.*\n+", "", str(answer.get("markdown", "")).strip())  # no second title
    body, dropped = keep_known_links(body, set(topic.links) | _pages(facts))
    if not title or len(body) < 1500:
        raise RuntimeError("the topic post came back incomplete")

    notes = [f"Topic: **{topic.kind}** ({topic.category})"]
    notes += [f"Removed a link to `{d}`" for d in dropped]
    notes += [f"Number not in the data: **{n}**" for n in unknown_numbers(body, facts)]
    path = content / "blog" / f"{today.isoformat()}-{slugify(title)}.md"
    front = "\n".join(
        [
            "---",
            f"title: {json.dumps(title, ensure_ascii=False)}",
            f"description: {json.dumps(description, ensure_ascii=False)}",
            f"date: {today.isoformat()}",
            f"category: {topic.category}",
            f"chips: {json.dumps(chips, ensure_ascii=False)}",
            "---",
        ]
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{front}\n\n{body}\n")
    return Draft(path, title, notes)


def _pages(value) -> set[str]:
    """Every site path in the facts ("/companies/x", "/jobs/1"): the links a post may use."""
    return set(re.findall(r'"(/(?:companies|jobs|roles|remote|locations)/[^"]+)"', json.dumps(value)))


def last_week(today: dt.date) -> dt.date:
    """The Monday of the most recent finished week."""
    return today - dt.timedelta(days=today.weekday() + 7)


def run(content: Path, week: dt.date | None = None, today: dt.date | None = None) -> list[Draft]:
    today = today or dt.datetime.now(dt.timezone.utc).date()
    week = week or last_week(today)
    stats, previous = reports(week)
    if not stats:
        raise RuntimeError(f"no numbers saved for the week of {week}: has the sync been running?")
    drafts = [d for d in [draft_commentary(week, stats, previous, content)] if d]
    drafts.append(draft_topic_post(week, stats, previous, content, today))
    return drafts
