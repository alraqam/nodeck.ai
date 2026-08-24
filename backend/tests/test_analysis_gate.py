"""Tests for the completeness gate and score clamping.

Both guard spend: the gate stops a paid model call on a profile with nothing
in it, and the clamp stops an out-of-range model response reaching the UI.
"""

import pytest

from app.api.v1.endpoints.analysis import _missing_sections
from app.schemas.report import FundabilityAnalysis, ScoreBreakdown
from app.services.ai import _clamp

COMPLETE = {
    "problem": {"description": "Manual bidding leaves revenue on the table."},
    "solution": {"description": "A closed-loop bidding engine."},
    "market": {"tam": 9_400_000_000.0},
}


class TestMissingSections:
    def test_complete_profile_passes(self):
        assert _missing_sections(COMPLETE) == []

    @pytest.mark.parametrize("sip", [None, {}], ids=["none", "empty-dict"])
    def test_absent_profile_reports_everything(self, sip):
        assert _missing_sections(sip) == [
            "Problem description",
            "Solution description",
            "Market TAM",
        ]

    def test_present_but_empty_sections_do_not_pass(self):
        # The bug this guards: {"problem": {}} is truthy, so a plain
        # `if not sip_data` check would let it straight through to a paid call.
        sip = {"problem": {}, "solution": {}, "market": {}}

        assert len(_missing_sections(sip)) == 3

    @pytest.mark.parametrize("blank", [None, "", [], {}])
    def test_every_blank_value_counts_as_missing(self, blank):
        sip = {**COMPLETE, "problem": {"description": blank}}

        assert _missing_sections(sip) == ["Problem description"]

    def test_reports_only_what_is_actually_missing(self):
        sip = {**COMPLETE}
        sip["market"] = {"tam": None}

        assert _missing_sections(sip) == ["Market TAM"]

    def test_a_tam_of_zero_counts_as_provided(self):
        # 0 is falsy but is a real, if damning, answer. The partner should get
        # to judge it rather than the gate rejecting the request.
        sip = {**COMPLETE, "market": {"tam": 0}}

        assert _missing_sections(sip) == []

    def test_tolerates_a_section_stored_as_none(self):
        sip = {**COMPLETE, "solution": None}

        assert _missing_sections(sip) == ["Solution description"]


def _analysis(total: int, **scores: int) -> FundabilityAnalysis:
    defaults = dict(
        market_opportunity=5,
        product_solution=5,
        traction_execution=5,
        team=5,
        moat_risks=5,
    )
    return FundabilityAnalysis(
        total_score=total,
        breakdown=ScoreBreakdown(**{**defaults, **scores}),
        summary="",
        red_flags=[],
        green_flags=[],
    )


class TestClamp:
    @pytest.mark.parametrize(
        "given, expected", [(150, 100), (-20, 0), (72, 72), (0, 0), (100, 100)]
    )
    def test_total_score_is_bounded(self, given, expected):
        assert _clamp(_analysis(given)).total_score == expected

    @pytest.mark.parametrize("given, expected", [(11, 10), (-3, 0), (7, 7)])
    def test_each_criterion_is_bounded(self, given, expected):
        clamped = _clamp(_analysis(50, market_opportunity=given))

        assert clamped.breakdown.market_opportunity == expected

    def test_clamps_every_criterion_not_just_the_first(self):
        clamped = _clamp(
            _analysis(
                50,
                market_opportunity=99,
                product_solution=99,
                traction_execution=99,
                team=99,
                moat_risks=99,
            )
        )

        assert all(
            getattr(clamped.breakdown, field) == 10
            for field in ScoreBreakdown.model_fields
        )
