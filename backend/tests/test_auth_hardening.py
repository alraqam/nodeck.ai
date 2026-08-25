"""Tests for the auth hardening.

Auth is unauthenticated by definition, so these cover the two things standing
between a password and an offline-speed guessing loop: a uniform response time
whether or not the account exists, and a per-account attempt budget.
"""

import time

import pytest

from app.core import security
from app.core.ratelimit import SlidingWindowLimiter, client_key


class FakeRequest:
    def __init__(self, host="1.2.3.4", headers=None):
        self.client = type("C", (), {"host": host})()
        self.headers = headers or {}


class TestClientKey:
    def test_uses_the_socket_address_by_default(self):
        assert client_key(FakeRequest(host="9.9.9.9"), False) == "9.9.9.9"

    def test_ignores_a_forged_header_when_proxies_are_not_trusted(self):
        # The whole point: X-Forwarded-For is client-controlled, so honouring it
        # on a directly-reachable API lets anyone mint an identity per request
        # and walk past every limit.
        request = FakeRequest(host="9.9.9.9", headers={"x-forwarded-for": "1.1.1.1"})

        assert client_key(request, False) == "9.9.9.9"

    def test_honours_the_header_when_proxies_are_trusted(self):
        request = FakeRequest(host="10.0.0.1", headers={"x-forwarded-for": "203.0.113.7"})

        assert client_key(request, True) == "203.0.113.7"

    def test_takes_the_first_hop_from_a_chain(self):
        request = FakeRequest(headers={"x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2"})

        assert client_key(request, True) == "203.0.113.7"

    def test_falls_back_when_there_is_no_client(self):
        request = FakeRequest()
        request.client = None

        assert client_key(request, False) == "unknown"


class TestAccountBudget:
    def test_a_successful_login_clears_the_budget(self):
        # Someone who mistypes a few times then gets it right must not be
        # locked out of their own account afterwards.
        limiter = SlidingWindowLimiter(limit=3, window_seconds=900)
        for _ in range(3):
            limiter.allow("victim@example.com")
        assert limiter.allow("victim@example.com") is False

        limiter.reset("victim@example.com")

        assert limiter.allow("victim@example.com") is True

    def test_reset_is_safe_on_an_unknown_key(self):
        SlidingWindowLimiter(limit=1, window_seconds=60).reset("never-seen")

    def test_one_account_being_attacked_does_not_lock_out_others(self):
        limiter = SlidingWindowLimiter(limit=2, window_seconds=900)
        for _ in range(5):
            limiter.allow("victim@example.com")

        assert limiter.allow("bystander@example.com") is True


class TestTimingOracle:
    def test_the_dummy_verification_costs_real_work(self):
        # If this ever became a no-op the oracle would silently reopen: an
        # unknown address would answer instantly while a known one paid for
        # Argon2.
        start = time.perf_counter()
        security.waste_password_time()
        elapsed = time.perf_counter() - start

        assert elapsed > 0.01, "a cheap no-op would leak account existence again"

    def test_it_costs_about_the_same_as_a_real_verification(self):
        real_hash = security.get_password_hash("a-real-password")

        start = time.perf_counter()
        security.verify_password("wrong", real_hash)
        real = time.perf_counter() - start

        start = time.perf_counter()
        security.waste_password_time()
        dummy = time.perf_counter() - start

        # Generous bounds: this asserts the same order of magnitude, not a
        # constant. Machine noise makes anything tighter flaky.
        assert 0.2 < (dummy / real) < 5.0, f"real={real:.3f}s dummy={dummy:.3f}s"

    def test_it_never_reports_success(self):
        assert security.waste_password_time() is None

    @pytest.mark.parametrize("attempt", ["", "x", "not-the-password"])
    def test_the_dummy_hash_matches_nothing(self, attempt):
        assert security.verify_password(attempt, security._DUMMY_HASH) is False
