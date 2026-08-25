"""Tests for the public share payload.

This is the only route with no authentication in front of it, so these tests
are about what must NOT come out. They assert on absence rather than presence,
because the failure mode is a field silently appearing - a new column on
Startup, a new SIP section - and nobody noticing until it is on someone's
public link.
"""

import pytest

from app.api.v1.endpoints.public import _pick, _public_profile


class FakeStartup:
    """Stands in for the ORM object, with extra attributes a real row also has.

    Deliberately carries founder_id, share_token and slug: if the serialiser
    ever starts reflecting the model instead of naming fields, these show up in
    the output and the tests fail.
    """

    def __init__(self, **overrides):
        self.name = "Zephyr Grid"
        self.one_liner = "Battery arbitrage, automated"
        self.stage = "SEED"
        self.industry = ["Energy"]
        self.founder_id = "11111111-1111-1111-1111-111111111111"
        self.share_token = "super-secret-token-value"
        self.share_score = False
        self.slug = "zephyr-grid-ff793e"
        self.sip_data = {
            "identity": {
                "website": "https://zephyrgrid.io",
                "location": "Utrecht",
                "founded_year": 2023,
                "contact_email": "vera@zephyrgrid.io",
            },
            "problem": {"description": "Manual bidding.", "pain_points": ["slow"]},
            "solution": {"description": "Autobid.", "moat": "Licence."},
            "market": {"tam": 9_400_000_000.0, "sam": 1_200_000_000.0},
            "traction": {"metrics": {"ARR": 410000}},
            "team": [
                {
                    "name": "Vera",
                    "role": "CEO",
                    "linkedin": "https://linkedin.com/in/vera",
                    "bio": "Ex-Vattenfall",
                }
            ],
            "fundraising": {
                "round_stage": "SEED",
                "ask_amount": 4_500_000.0,
                "valuation_cap": 22_000_000.0,
                "use_of_funds": "Hiring",
            },
        }
        for key, value in overrides.items():
            setattr(self, key, value)


class TestNeverLeaks:
    @pytest.fixture
    def payload(self):
        return _public_profile(FakeStartup(), score=None)

    @pytest.mark.parametrize(
        "forbidden",
        [
            "founder_id",
            "share_token",
            "share_score",
            "slug",
            "sip_data",
            "created_at",
            "updated_at",
        ],
    )
    def test_internal_fields_are_absent(self, payload, forbidden):
        assert forbidden not in payload

    def test_contact_email_is_not_published(self, payload):
        # A public page is a spam target; the founder hands out their address
        # themselves.
        assert "contact_email" not in payload["identity"]
        assert "vera@zephyrgrid.io" not in str(payload)

    def test_valuation_cap_is_not_published(self):
        # Live deal terms are not pitch material.
        payload = _public_profile(FakeStartup(), score=None)

        assert "valuation_cap" not in payload["fundraising"]
        assert "22" not in str(payload["fundraising"].get("ask_amount", ""))

    def test_an_unknown_sip_section_is_not_republished(self):
        # The SIP is free-form JSONB. Anything a founder stores that the
        # serialiser does not name must not reach the page.
        startup = FakeStartup()
        startup.sip_data["private_notes"] = "we are running out of money"
        startup.sip_data["problem"]["internal_only"] = "do not share"

        payload = _public_profile(startup, score=None)

        assert "private_notes" not in str(payload)
        assert "do not share" not in str(payload)

    def test_a_new_column_on_startup_is_not_republished(self):
        startup = FakeStartup()
        startup.secret_new_field = "added by a later migration"

        payload = _public_profile(startup, score=None)

        assert "added by a later migration" not in str(payload)


class TestScoreOptIn:
    def test_score_is_absent_unless_supplied(self):
        assert _public_profile(FakeStartup(), score=None)["score"] is None

    def test_supplied_score_is_published(self):
        score = {"total_score": 72, "breakdown": {}, "summary": "Solid.", "green_flags": ["a"]}

        payload = _public_profile(FakeStartup(), score=score)

        assert payload["score"]["total_score"] == 72
        assert payload["score"]["green_flags"] == ["a"]

    def test_the_endpoint_never_assembles_red_flags(self):
        # The caller builds the score dict without a red_flags key at all, so
        # there is nothing here to filter out - absence is structural.
        score = {"total_score": 72, "breakdown": {}, "summary": "", "green_flags": []}

        payload = _public_profile(FakeStartup(), score=score)

        assert "red_flags" not in payload["score"]


class TestPick:
    def test_keeps_only_named_fields(self):
        assert _pick({"a": 1, "b": 2}, "a") == {"a": 1}

    @pytest.mark.parametrize("empty", [None, "", [], {}])
    def test_drops_empty_values(self, empty):
        assert _pick({"a": empty}, "a") == {}

    def test_keeps_false_and_zero(self):
        # `validated: false` and a TAM of 0 are answers, not gaps.
        assert _pick({"validated": False}, "validated") == {"validated": False}
        assert _pick({"tam": 0}, "tam") == {"tam": 0}

    @pytest.mark.parametrize("bad", [None, "a string", 42, ["a", "list"]])
    def test_survives_a_section_that_is_not_a_dict(self, bad):
        assert _pick(bad, "anything") == {}

    def test_empty_team_members_are_dropped(self):
        startup = FakeStartup()
        startup.sip_data["team"] = [{}, {"name": "Real Person"}]

        payload = _public_profile(startup, score=None)

        assert payload["team"] == [{"name": "Real Person"}]
