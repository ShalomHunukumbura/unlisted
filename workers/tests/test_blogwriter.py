"""The checks on model-written blog drafts (no model or database needed)."""
import datetime as dt

from jobsite import blogwriter as b


def test_only_site_links_survive():
    md = "See [remote roles](/remote/sri-lanka), [a blog](https://spam.example) and [Linear](/companies/linear)."
    out, dropped = b.keep_known_links(md, {"/remote/sri-lanka", "/companies/linear"})
    assert out == "See [remote roles](/remote/sri-lanka), a blog and [Linear](/companies/linear)."
    assert dropped == ["https://spam.example"]


def test_numbers_must_come_from_the_facts():
    facts = {"roles": 17643, "remote_percent": 18, "pay": {"median_k": 179}}
    md = "17,643 roles, 18% remote, a median of $179K, up 42% on last week, in 2 steps."
    assert b.unknown_numbers(md, facts) == ["42%"]


def test_numbers_in_link_targets_are_ignored():
    assert b.unknown_numbers("[a role](/jobs/123456)", {"x": 1}) == []


def test_last_week_is_the_previous_monday():
    assert b.last_week(dt.date(2026, 10, 12)) == dt.date(2026, 10, 5)  # a Monday
    assert b.last_week(dt.date(2026, 10, 14)) == dt.date(2026, 10, 5)  # a Wednesday


def test_slug():
    assert b.slugify("Who's hiring Rust engineers: week of 5 Oct") == "who-s-hiring-rust-engineers-week-of-5-oct"


def test_topic_post_written_and_checked(tmp_path, monkeypatch):
    topic = b.Topic("skill", "Tech", "brief", {"roles": 860, "top_companies": [{"page": "/companies/acme"}]}, ["/roles/python"])
    monkeypatch.setattr(b, "pick_topic", lambda *a: topic)
    body = "## Who is hiring\n\n" + ("[Acme](/companies/acme) posted roles. " * 60) + "860 roles, 999 of them new. [x](https://x.example)"
    monkeypatch.setattr(b, "ask", lambda system, user: {
        "title": "Python roles this week", "description": "Who hired.", "chips": ["Python", "Remote", "AWS", "extra"],
        "markdown": "# A second title\n\n" + body,
    })
    draft = b.draft_topic_post(dt.date(2026, 10, 5), {}, None, tmp_path, dt.date(2026, 10, 12))
    text = draft.path.read_text()
    assert draft.path.name == "2026-10-12-python-roles-this-week.md"
    assert 'chips: ["Python", "Remote", "AWS"]' in text and "category: Tech" in text
    assert "# A second title" not in text and "https://x.example" not in text
    assert "Number not in the data: **999**" in draft.notes
