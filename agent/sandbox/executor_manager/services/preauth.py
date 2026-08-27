"""Small per-address limiter applied before sandbox authentication."""

import os
import threading
import time
from collections import deque

from fastapi import Request
from limits import parse_many
from slowapi.errors import RateLimitExceeded

PRE_AUTH_RATE_LIMIT = os.getenv("SANDBOX_RUN_PREAUTH_RATE_LIMIT", "30/minute")


class _LimitDescriptor:
    def __init__(self, limit):
        self.limit = limit
        self.error_message = "Too many requests, please try again later"


def _parse_rate_limit(value: str):
    items = list(parse_many(value))
    if len(items) != 1:
        raise ValueError(f"SANDBOX_RUN_PREAUTH_RATE_LIMIT must contain one rate, got {value!r}")
    return items[0]


class PreAuthRateLimiter:
    def __init__(self, limit):
        self._limit = limit
        self._window_seconds = limit.get_expiry()
        self._max_amount = limit.amount
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()

    def hit(self, address: str, now: float | None = None) -> None:
        timestamp = time.monotonic() if now is None else now
        with self._lock:
            window = self._hits.setdefault(address, deque())
            cutoff = timestamp - self._window_seconds
            while window and window[0] <= cutoff:
                window.popleft()
            if len(window) >= self._max_amount:
                raise RateLimitExceeded(_LimitDescriptor(self._limit))
            window.append(timestamp)
            if len(self._hits) > 10_000:
                for key in [key for key, hits in self._hits.items() if not hits or hits[-1] <= cutoff]:
                    del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


preauth_limiter = PreAuthRateLimiter(_parse_rate_limit(PRE_AUTH_RATE_LIMIT))


def preauth_rate_limit(request: Request) -> None:
    preauth_limiter.hit(request.client.host if request.client else "unknown")
