"""Embeddings for the "For you" feed.

Each open job gets all-MiniLM-L6-v2's 384 numbers for its title and the start
of its description. The browser runs the same model (Transformers.js,
Xenova/all-MiniLM-L6-v2) on an uploaded CV, so the two can be compared with a
cosine distance in Postgres. Checked: fastembed's output matches the browser's
full-precision model to five decimals; the browser's 8-bit one is 0.994
cosine-similar to it.

fastembed (ONNX Runtime) instead of sentence-transformers: no PyTorch, so the
hourly GitHub Actions run installs in seconds. It's an optional extra:
`pip install -e "workers[embed]"`.
"""
from __future__ import annotations

import logging
import time

from .config import settings
from .db import cursor
from .html import to_text

log = logging.getLogger(__name__)

MODEL = "sentence-transformers/all-MiniLM-L6-v2"
# The model reads at most 256 word pieces, about 1,000 characters of English.
# The title goes first, twice: descriptions often open with company
# boilerplate, and the title is what the job is.
TEXT_CHARS = 1000


def job_text(title: str, department: str | None, html: str | None) -> str:
    head = f"{title}. {title}."
    if department:
        head += f" {department}."
    body = to_text(html) or ""
    return f"{head} {body}"[:TEXT_CHARS]


def _vector(values) -> str:
    """pgvector's text form; Postgres casts it to halfvec."""
    return "[" + ",".join(f"{float(v):.5f}" for v in values) + "]"


def embed_new(batch: int = 256, max_seconds: float = 900) -> int:
    """Embed the listed jobs (open, past max_job_age_days) that don't have one
    yet, newest first. Stops after max_seconds so a large backlog (e.g. after
    a refill) spreads over runs."""
    from fastembed import TextEmbedding  # optional dependency, heavy import

    model = TextEmbedding(MODEL)
    started = time.monotonic()
    done = 0
    while time.monotonic() - started < max_seconds:
        with cursor() as cur:
            cur.execute(
                """SELECT id, title, department, description_html FROM jobs
                    WHERE embedding IS NULL AND closed_at IS NULL
                      AND COALESCE(posted_at, first_seen_at) > now() - make_interval(days => %s)
                    ORDER BY first_seen_at DESC LIMIT %s""",
                (settings.max_job_age_days, batch),
            )
            rows = cur.fetchall()
        if not rows:
            break
        texts = [job_text(r["title"], r["department"], r["description_html"]) for r in rows]
        vectors = list(model.embed(texts, batch_size=64))
        with cursor(commit=True) as cur:
            cur.executemany(
                "UPDATE jobs SET embedding = %s::halfvec WHERE id = %s",
                [(_vector(v), r["id"]) for r, v in zip(rows, vectors)],
            )
        done += len(rows)
        log.info("embedded %d jobs", done)
    return done
