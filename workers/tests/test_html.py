"""Sanitization of third-party HTML — a security boundary, so test it as one."""
from jobsite.html import clean_description, sanitize, to_text


def test_strips_script():
    html, text = clean_description("<p>Real</p><script>alert(1)</script>")
    assert "<script" not in html
    assert "alert" not in (html or "")
    assert text == "Real"


def test_strips_event_handlers():
    html, _ = clean_description('<p onclick="steal()">Hi</p><img src=x onerror=bad()>')
    assert "onclick" not in html
    assert "onerror" not in html


def test_strips_iframe_and_style():
    html, _ = clean_description('<iframe src="evil"></iframe><p style="x">t</p>')
    assert "<iframe" not in html
    assert "style=" not in html


def test_keeps_safe_formatting():
    html, _ = clean_description("<h3>Role</h3><ul><li><strong>One</strong></li></ul>")
    for tag in ("<h3>", "<ul>", "<li>", "<strong>"):
        assert tag in html


def test_links_get_rel():
    html, _ = clean_description('<a href="https://example.com">x</a>')
    assert "noopener" in html and "nofollow" in html


def test_javascript_url_removed():
    html, _ = clean_description('<a href="javascript:alert(1)">x</a>')
    assert "javascript:" not in html


def test_text_extraction_collapses_whitespace():
    assert to_text("<p>a</p>\n\n   <p>b</p>") == "a b"


def test_empty_inputs():
    assert sanitize(None) is None
    assert clean_description("") == (None, None)
