"""Tests for the scoreable-profile gate and score clamping.

Both guard spend: the gate stops a paid model call on a profile with nothing in
it, and the clamp stops an out-of-range model response reaching the UI.

The gate deliberately used to demand a TAM as well. That was wrong twice over -
real decks routinely omit market sizing, so cohort imports were rejected
wholesale on a field the deck never claimed; and the prompt already treats a
missing TAM as a red flag, so refusing to score meant the founder never heard
the one thing they most needed told.
"""

import pytest

from app.api.v1.endpoints.analysis import _missing_sections
from app.schemas.report import FundabilityAnalysis, ScoreBreakdown
from app.services.ai import _clamp


class TestMissingSections:
    @pytest.mark.parametrize(
        "sip",
        [
            {"problem": {"description": "Bidding is manual."}},
            {"solution": {"description": "An autobid engine."}},
            {
                "problem": {"description": "Manual bidding."},
                "solution": {"description": "Autobid."},
                "market": {"tam": 9_400_000_000.0},
            },
        ],
        ids=["problem-only", "solution-only", "full-profile"],
    )
    def test_anything_describable_is_scoreable(self, sip):
        assert _missing_sections(sip) == []

    def test_a_missing_market_size_no_longer_blocks_scoring(self):
        # The regression this guards: a cohort of real decks being refused for
        # not stating a TAM.
        assert _missing_sections({"problem": {"description": "Bidding is manual."}}) == []

    @pytest.mark.parametrize("sip", [None, {}], ids=["none", "empty-dict"])
    def test_absent_profile_is_refused(self, sip):
        assert _missing_sections(sip) != []

    def test_present_but_empty_sections_do_not_pass(self):
        # {"problem": {}} is truthy, so a plain falsiness check would let it
        # straight through to a paid call.
        assert _missing_sections({"problem": {}, "solution": {}, "market": {}}) != []

    @pytest.mark.parametrize("blank", [None, "", "   ", "\n\t"])
    def test_blank_text_counts_as_missing(self, blank):
        assert _missing_sections({"problem": {"description": blank}}) != []

    def test_tolerates_a_section_stored_as_none(self):
        assert _missing_sections({"problem": None, "solution": None}) != []

    def test_tolerates_a_section_of_the_wrong_type(self):
        assert _missing_sections({"problem": "a string", "solution": 42}) != []

    def test_the_message_names_both_options(self):
        missing = _missing_sections({})

        assert any("problem" in m for m in missing)
        assert any("solution" in m for m in missing)


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
        confidence="MEDIUM",
        top_fixes=[],
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

    def test_clamping_leaves_the_narrative_alone(self):
        # Only numbers are bounded; rewriting the model's own words would make
        # the summary contradict the score it explains.
        analysis = _analysis(150)
        analysis.summary = "Strong team, thin traction."
        analysis.confidence = "HIGH"

        clamped = _clamp(analysis)

        assert clamped.summary == "Strong team, thin traction."
        assert clamped.confidence == "HIGH"


class TestSchemaRequiresEvidenceFields:
    def test_confidence_is_constrained_to_known_bands(self):
        with pytest.raises(Exception):
            FundabilityAnalysis(
                total_score=50,
                breakdown=ScoreBreakdown(
                    market_opportunity=5,
                    product_solution=5,
                    traction_execution=5,
                    team=5,
                    moat_risks=5,
                ),
                summary="",
                red_flags=[],
                green_flags=[],
                confidence="VERY_SURE",
                top_fixes=[],
            )

    def test_the_json_schema_carries_no_range_keywords(self):
        # ge/le render as minimum/maximum, which schema-constrained structured
        # output rejects - a 400 you would only discover at analysis time.
        import json

        schema = json.dumps(FundabilityAnalysis.model_json_schema())

        assert '"minimum"' not in schema
        assert '"maximum"' not in schema
