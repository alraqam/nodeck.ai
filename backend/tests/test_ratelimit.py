"""Tests for the sliding-window rate limiter."""

import time

import pytest

from app.core.ratelimit import SlidingWindowLimiter


class TestSlidingWindowLimiter:
    def test_allows_up_to_the_limit(self):
        limiter = SlidingWindowLimiter(limit=3, window_seconds=60)

        assert [limiter.allow("a") for _ in range(3)] == [True, True, True]

    def test_blocks_past_the_limit(self):
        limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
        limiter.allow("a")
        limiter.allow("a")

        assert limiter.allow("a") is False

    def test_keys_are_independent(self):
        # One noisy client must not lock everyone else out.
        limiter = SlidingWindowLimiter(limit=1, window_seconds=60)
        limiter.allow("a")

        assert limiter.allow("b") is True

    def test_the_window_slides(self):
        limiter = SlidingWindowLimiter(limit=1, window_seconds=0.05)
        assert limiter.allow("a") is True
        assert limiter.allow("a") is False

        time.sleep(0.06)

        assert limiter.allow("a") is True, "the hit should have aged out"

    def test_a_blocked_call_does_not_extend_the_block(self):
        # Rejected attempts must not be recorded, or a client hammering the
        # endpoint would keep pushing its own reset further away.
        limiter = SlidingWindowLimiter(limit=1, window_seconds=0.05)
        limiter.allow("a")
        for _ in range(20):
            limiter.allow("a")

        time.sleep(0.06)

        assert limiter.allow("a") is True

    def test_retry_after_is_a_positive_whole_number(self):
        limiter = SlidingWindowLimiter(limit=1, window_seconds=60)
        limiter.allow("a")

        retry = limiter.retry_after("a")

        assert isinstance(retry, int)
        assert 1 <= retry <= 61

    def test_retry_after_is_zero_for_an_unseen_key(self):
        assert SlidingWindowLimiter(limit=1, window_seconds=60).retry_after("new") == 0

    def test_idle_keys_are_evicted(self):
        # Otherwise the dict grows once per unique client, forever - a slow
        # memory leak on a route anyone can reach.
        limiter = SlidingWindowLimiter(limit=1, window_seconds=0.01)
        for i in range(2100):
            limiter.allow(f"client-{i}")

        time.sleep(0.02)
        limiter.allow("trigger-the-sweep")

        assert len(limiter._hits) < 2100

    @pytest.mark.parametrize("limit", [1, 5, 60])
    def test_exactly_limit_calls_succeed(self, limit):
        limiter = SlidingWindowLimiter(limit=limit, window_seconds=60)

        allowed = sum(limiter.allow("a") for _ in range(limit * 2))

        assert allowed == limit
