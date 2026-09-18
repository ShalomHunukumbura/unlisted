"""Polite HTTP client: per-ATS token bucket, retries, honest User-Agent.

Politeness is built in here rather than bolted on later, because every connector
goes through this module.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass

import httpx
from tenacity import (
    retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter,
)

from .config import settings

log = logging.getLogger(__name__)


class RetryableStatus(Exception):
    """A response worth retrying (429 / 5xx)."""


@dataclass
class RateLimit:
    rate_per_sec: float
    burst: int = 5


class TokenBucket:
    def __init__(self, limit: RateLimit):
        self.rate = limit.rate_per_sec
        self.capacity = float(limit.burst)
        self._tokens = float(limit.burst)
        self._updated = time.monotonic()
        self._lock = threading.Lock()

    def take(self) -> None:
        with self._lock:
            while True:
                now = time.monotonic()
                self._tokens = min(
                    self.capacity, self._tokens + (now - self._updated) * self.rate
                )
                self._updated = now
                if self._tokens >= 1:
                    self._tokens -= 1
                    return
                time.sleep((1 - self._tokens) / self.rate)

    def slow_down(self, factor: float = 0.5) -> None:
        """A 429 means slow this ATS for the rest of the run, not just retry once."""
        with self._lock:
            self.rate = max(0.2, self.rate * factor)
            log.warning("rate limited; reducing to %.2f req/s", self.rate)


# Defaults per plan: documented-API providers get 5 req/s, undocumented ones 1.
_BUCKETS: dict[str, TokenBucket] = {}
_DEFAULT_LIMITS = {
    "greenhouse": RateLimit(5),
    "lever": RateLimit(5),
    "ashby": RateLimit(5),
    "smartrecruiters": RateLimit(8),
    "workday": RateLimit(1, burst=2),
}
_lock = threading.Lock()


def bucket(ats: str) -> TokenBucket:
    with _lock:
        if ats not in _BUCKETS:
            _BUCKETS[ats] = TokenBucket(_DEFAULT_LIMITS.get(ats, RateLimit(2)))
        return _BUCKETS[ats]


_client: httpx.Client | None = None


def client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            http2=True,
            timeout=settings.http_timeout,
            follow_redirects=True,
            headers={"User-Agent": settings.jobsite_user_agent,
                     "Accept": "application/json"},
        )
    return _client


@retry(
    retry=retry_if_exception_type(
        (RetryableStatus, httpx.TimeoutException, httpx.NetworkError)
    ),
    wait=wait_exponential_jitter(initial=1, max=30),
    stop=stop_after_attempt(4),
    reraise=True,
)
def request(method: str, url: str, ats: str, **kw) -> httpx.Response:
    """One rate-limited, retrying request.

    404 is never retried: for slug validation it is a meaningful answer, not a
    failure.
    """
    bucket(ats).take()
    resp = client().request(method, url, **kw)

    if resp.status_code == 429:
        bucket(ats).slow_down()
        retry_after = resp.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            time.sleep(min(int(retry_after), 60))
        raise RetryableStatus(f"429 from {url}")
    if resp.status_code >= 500:
        raise RetryableStatus(f"{resp.status_code} from {url}")
    return resp


def get_json(url: str, ats: str, **kw):
    resp = request("GET", url, ats, **kw)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()
