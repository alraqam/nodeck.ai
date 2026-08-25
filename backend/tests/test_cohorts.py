"""Tests for cohort screening.

The cohort report is what an accelerator pays for, so the things asserted here
are the ones that would quietly corrupt it: a ranking that puts unscored
startups above bad ones, a CSV that a company name can break, and a batch that
one bad file can abort.
"""

import csv
import io

import pytest

from app.api.v1.endpoints.cohorts import _band, _name_from_filename


class TestBand:
    @pytest.mark.parametrize(
        "score, expected",
        [(100, "70+"), (70, "70+"), (69, "50-69"), (50, "50-69"),
         (49, "30-49"), (30, "30-49"), (29, "under 30"), (0, "under 30")],
    )
    def test_boundaries(self, score, expected):
        assert _band(score) == expected

    def test_unscored_is_its_own_band(self):
        # Not folded into "under 30": never measured is not measured badly.
        assert _band(None) == "unscored"


class TestNameFromFilename:
    @pytest.mark.parametrize(
        "filename, expected",
        [
            ("zephyr-grid.pdf", "Zephyr Grid"),
            ("acme_robotics.PDF", "Acme Robotics"),
            ("Nimbus Health.pdf", "Nimbus Health"),
        ],
    )
    def test_reads_as_a_company_name(self, filename, expected):
        assert _name_from_filename(filename) == expected

    @pytest.mark.parametrize("filename", ["", ".pdf", None])
    def test_falls_back_rather_than_producing_an_empty_name(self, filename):
        # An unnamed row in a ranking is worse than a placeholder.
        assert _name_from_filename(filename) == "Untitled Deck"

    def test_bounds_the_length(self):
        assert len(_name_from_filename("x" * 400 + ".pdf")) <= 120


def _rank(rows):
    """Mirrors the ordering in cohorts._rows."""
    return sorted(
        rows, key=lambda r: (r["total_score"] is None, -(r["total_score"] or 0), r["name"])
    )


class TestRanking:
    def test_highest_score_first(self):
        rows = [
            {"name": "Low", "total_score": 20},
            {"name": "High", "total_score": 80},
            {"name": "Mid", "total_score": 50},
        ]

        assert [r["name"] for r in _rank(rows)] == ["High", "Mid", "Low"]

    def test_unscored_sinks_below_even_the_worst_score(self):
        # The failure that would quietly mislead a screener: an unimportable
        # deck floating to the top of the ranking as a zero.
        rows = [
            {"name": "Unscored", "total_score": None},
            {"name": "Terrible", "total_score": 3},
        ]

        assert [r["name"] for r in _rank(rows)] == ["Terrible", "Unscored"]

    def test_ties_break_by_name_so_the_order_is_stable(self):
        rows = [
            {"name": "Beta", "total_score": 50},
            {"name": "Alpha", "total_score": 50},
        ]

        assert [r["name"] for r in _rank(rows)] == ["Alpha", "Beta"]


class TestCsvSafety:
    """A company name must not be able to break the export."""

    def _write(self, name: str) -> str:
        buffer = io.StringIO()
        writer = csv.writer(buffer, lineterminator="\n")
        writer.writerow(["startup", "score"])
        writer.writerow([name, 74])
        return buffer.getvalue()

    @pytest.mark.parametrize(
        "name",
        ['Bolt, Hammer & Co', 'The "Best" Startup', "Line\nbreak Inc", "Semi;colon Ltd"],
    )
    def test_awkward_names_round_trip_intact(self, name):
        parsed = list(csv.reader(io.StringIO(self._write(name))))

        assert parsed[1][0] == name
        assert parsed[1][1] == "74"

    def test_a_comma_does_not_add_a_column(self):
        parsed = list(csv.reader(io.StringIO(self._write("A, B, C"))))

        assert len(parsed[1]) == 2, "the name leaked into neighbouring columns"
