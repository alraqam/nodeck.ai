"""A small in-process rate limiter.

Used on the public share route, which is the one endpoint anyone can reach
without an account. Tokens are 43 characters of URL-safe randomness, so
guessing one is hopeless - but an unlimited endpoint still lets a single client
hammer the database for free, and there is no login to throttle behind.

In-process on purpose. A shared limiter needs Redis, and adding a broker to
enforce a limit on one route is the wrong trade for an MVP. The honest
consequence is written down rather than hidden: with several application
processes the effective limit is per process, so the real ceiling is the limit
times the process count.
"""

import time
from collections import deque
from threading import Lock
from typing import Deque, Dict


class SlidingWindowLimiter:
    """Allow `limit` requests per `window` seconds, per key.

    A sliding window rather than a fixed one: a fixed window lets a caller
    spend its whole budget at the end of one window and again at the start of
    the next, which is twice the intended rate at the boundary.
    """

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = {}
        # FastAPI runs sync work in a threadpool, so the dict needs guarding.
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window

        with self._lock:
            hits = self._hits.get(key)
            if hits is None:
                hits = self._hits[key] = deque()

            while hits and hits[0] < cutoff:
                hits.popleft()

            if len(hits) >= self.limit:
                return False

            hits.append(now)

            # Opportunistic sweep. Without it the dict grows once per unique
            # client forever, which is a slow memory leak on a public route.
            if len(self._hits) > 2048:
                self._evict_idle(cutoff)
            return True

    def _evict_idle(self, cutoff: float) -> None:
        """Drop keys with no hits left in the window. Caller holds the lock."""
        for key in [k for k, v in self._hits.items() if not v or v[-1] < cutoff]:
            del self._hits[key]

    def reset(self, key: str) -> None:
        """Forget a key's history, e.g. after a successful login."""
        with self._lock:
            self._hits.pop(key, None)

    def retry_after(self, key: str) -> int:
        """Whole seconds until the oldest hit falls out of the window."""
        with self._lock:
            hits = self._hits.get(key)
            if not hits:
                return 0
            return max(1, int(self.window - (time.monotonic() - hits[0])) + 1)


def client_key(request, trust_proxy_headers: bool) -> str:
    """Identify the caller for rate limiting.

    X-Forwarded-For is honoured only where a proxy is expected to set it. The
    header is client-controlled, so trusting it on a directly-reachable API
    would let anyone mint a fresh identity per request and bypass every limit
    here.
    """
    if trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
