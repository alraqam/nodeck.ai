"""The signing key must never be guessable.

With a known SECRET_KEY anyone can mint a valid token for any account without
a password - a total auth bypass that produces no error, no log line and no
visible symptom. There is nothing to degrade gracefully to, so the only safe
behaviour is refusing to start.
"""

import secrets

import pytest
from pydantic import ValidationError

from app.core.config import Settings, WEAK_SECRETS


def build(secret: str) -> Settings:
    # _env_file=None so the developer's real .env cannot mask what is tested.
    return Settings(SECRET_KEY=secret, _env_file=None)


class TestRejectsGuessableKeys:
    @pytest.mark.parametrize("weak", sorted(WEAK_SECRETS))
    def test_every_known_placeholder_is_refused(self, weak):
        with pytest.raises(ValidationError, match="SECRET_KEY"):
            build(weak)

    @pytest.mark.parametrize(
        "variant",
        ["Change_Me", "CHANGE_ME", "  change_me  ", "ChAnGeMe"],
    )
    def test_placeholders_are_caught_regardless_of_case_or_padding(self, variant):
        # An attacker does not care how it was typed.
        with pytest.raises(ValidationError, match="SECRET_KEY"):
            build(variant)

    def test_the_value_this_repo_once_shipped_is_refused(self):
        # Guards against the exact string being reintroduced as a default.
        with pytest.raises(ValidationError):
            build("CHANGE_ME_IN_PROD_TO_A_SUPER_SECRET_KEY")

    @pytest.mark.parametrize("length", [0, 1, 8, 31])
    def test_short_keys_are_refused(self, length):
        with pytest.raises(ValidationError, match="at least 32"):
            build("a" * length)

    def test_the_error_says_how_to_fix_it(self):
        with pytest.raises(ValidationError) as exc:
            build("change_me")

        message = str(exc.value)
        assert "token_urlsafe" in message, "the error should hand over the command"


class TestAcceptsRealKeys:
    def test_a_generated_key_is_accepted(self):
        assert build(secrets.token_urlsafe(48)).SECRET_KEY

    def test_exactly_32_characters_is_enough(self):
        assert len(build("a" * 32).SECRET_KEY) == 32

    def test_there_is_no_default_to_fall_back_on(self):
        # A default is what made this dangerous: the app booted, everything
        # worked, and every token was forgeable.
        with pytest.raises(ValidationError, match="SECRET_KEY"):
            Settings(_env_file=None)
