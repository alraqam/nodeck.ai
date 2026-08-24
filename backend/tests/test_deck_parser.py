"""Tests for PDF extraction and the parsed-deck merge.

The merge carries the product's strongest promise - that uploading a deck can
never overwrite something the founder typed - so it is tested field by field
rather than by a single happy path.
"""

import pytest

from app.schemas.report import ParsedDeckSIP
from app.services.deck_parser import DeckParseError, apply_parsed_deck, extract_pdf_text


class TestExtractPdfText:
    @pytest.mark.parametrize(
        "blob, label",
        [
            (b"", "empty file"),
            (b"hello world", "plain text"),
            (b"%PDF-1.4\nbut truncated", "truncated header"),
            (b"\x00\x01\x02\x03", "binary noise"),
        ],
    )
    def test_unreadable_input_raises_deck_parse_error(self, blob, label):
        # Never a bare exception: the endpoint turns DeckParseError into a 400
        # with the message shown to the founder.
        with pytest.raises(DeckParseError):
            extract_pdf_text(blob)

    def test_error_messages_are_user_facing(self):
        with pytest.raises(DeckParseError) as exc:
            extract_pdf_text(b"not a pdf")
        message = str(exc.value)
        assert message.endswith(".")
        # No stack detail, module paths or exception class names leaking out.
        assert "Traceback" not in message
        assert "pypdf" not in message.lower()


class TestApplyParsedDeck:
    def test_fills_only_empty_fields(self):
        existing = {"problem": {"description": "WRITTEN BY FOUNDER"}}
        parsed = ParsedDeckSIP(
            problem_description="extracted from deck",
            solution_description="also from deck",
        )

        merged, filled = apply_parsed_deck(existing, parsed)

        assert merged["problem"]["description"] == "WRITTEN BY FOUNDER"
        assert merged["solution"]["description"] == "also from deck"
        assert "Problem description" not in filled
        assert "Solution description" in filled

    @pytest.mark.parametrize(
        "empty_value",
        [None, "", [], {}],
        ids=["none", "empty-string", "empty-list", "empty-dict"],
    )
    def test_every_empty_representation_counts_as_fillable(self, empty_value):
        # A stored "" must be treated as a gap, not as content worth protecting.
        existing = {"problem": {"description": empty_value}}
        parsed = ParsedDeckSIP(problem_description="from deck")

        merged, filled = apply_parsed_deck(existing, parsed)

        assert merged["problem"]["description"] == "from deck"
        assert "Problem description" in filled

    def test_zero_is_content_not_a_gap(self):
        # 0 is falsy but a real answer - a stated TAM of 0 must survive.
        existing = {"market": {"tam": 0}}
        parsed = ParsedDeckSIP(tam=9_400_000_000.0)

        merged, filled = apply_parsed_deck(existing, parsed)

        assert merged["market"]["tam"] == 0
        assert "TAM" not in filled

    def test_does_not_mutate_the_input(self):
        # The caller reassigns the result; mutating in place would also defeat
        # SQLAlchemy change detection on the JSONB column.
        existing = {"market": {"tam": 100.0}}
        original = {"market": {"tam": 100.0}}
        parsed = ParsedDeckSIP(sam=50.0)

        apply_parsed_deck(existing, parsed)

        assert existing == original

    def test_creates_absent_sections(self):
        merged, filled = apply_parsed_deck({}, ParsedDeckSIP(ask_amount=4_500_000.0))

        assert merged["fundraising"]["ask_amount"] == 4_500_000.0
        assert "Ask amount" in filled

    def test_handles_none_sip(self):
        merged, filled = apply_parsed_deck(None, ParsedDeckSIP(product_name="Autobid"))

        assert merged["solution"]["product_name"] == "Autobid"
        assert filled == ["Product name"]

    def test_empty_parse_reports_nothing_filled(self):
        existing = {"problem": {"description": "kept"}}

        merged, filled = apply_parsed_deck(existing, ParsedDeckSIP())

        assert filled == []
        assert merged == existing

    def test_survives_a_section_stored_with_the_wrong_shape(self):
        # Legacy or hand-edited data could put a string where a dict belongs.
        # That must not raise; leave what we do not understand alone.
        existing = {"market": "not a dict"}

        merged, filled = apply_parsed_deck(existing, ParsedDeckSIP(tam=1.0))

        assert merged["market"] == "not a dict"
        assert "TAM" not in filled

    def test_filled_labels_are_human_readable(self):
        _, filled = apply_parsed_deck(
            {}, ParsedDeckSIP(tam=1.0, use_of_funds="hiring", pain_points=["slow"])
        )

        # These strings are rendered directly as badges in the UI.
        assert set(filled) == {"TAM", "Use of funds", "Pain points"}
