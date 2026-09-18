"""HTML sanitization for third-party job descriptions.

We use nh3, not bleach: bleach 6.4.0 is classified "Development Status :: 7 -
Inactive" on PyPI and states it receives no further releases *including for
security issues*. Sanitizing untrusted third-party HTML is a security boundary,
so an unmaintained sanitizer is disqualifying.

Descriptions are sanitized here, server-side, exactly once. The web app renders
the stored HTML directly and must not re-sanitize it in JS.
"""
from __future__ import annotations

import nh3
from selectolax.lexbor import LexborHTMLParser

ALLOWED_TAGS = {
    "p", "br", "ul", "ol", "li", "strong", "em", "b", "i", "u",
    "h1", "h2", "h3", "h4", "a", "blockquote", "code", "pre", "hr",
}
ALLOWED_ATTRS = {"a": {"href", "title"}}


def sanitize(html: str | None) -> str | None:
    """Strip to an allowlist. nh3 drops script/iframe/style and every on* handler."""
    if not html:
        return None
    cleaned = nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        link_rel="noopener noreferrer nofollow",
    )
    return cleaned or None


def to_text(html: str | None) -> str | None:
    """Plain text for the search column.

    We derive this ourselves even when an ATS supplies a "plain" field, because
    those are inconsistently formatted across (and within) providers.
    """
    if not html:
        return None
    text = LexborHTMLParser(html).text(separator=" ")
    text = " ".join(text.split())
    return text or None


def clean_description(html: str | None) -> tuple[str | None, str | None]:
    """Return (sanitized_html, plain_text)."""
    safe = sanitize(html)
    return safe, to_text(safe)
