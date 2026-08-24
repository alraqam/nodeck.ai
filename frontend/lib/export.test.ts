import { describe, expect, it } from "vitest"
import {
    filenameFor,
    investorViewToMarkdown,
    reportToMarkdown,
    slugify,
} from "./export"
import type { Report } from "./types"

function report(overrides: Partial<Report> = {}): Report {
    return {
        id: "r1",
        startup_id: "s1",
        type: "FUNDABILITY_SCORE",
        status: "COMPLETED",
        created_at: "2026-08-24T10:30:00Z",
        content: {},
        ...overrides,
    }
}

describe("reportToMarkdown", () => {
    it("refuses anything not completed", () => {
        for (const status of ["PENDING", "FAILED"] as const) {
            expect(reportToMarkdown(report({ status }), "Zephyr")).toBeNull()
        }
    })

    it("refuses a completed report with no content", () => {
        expect(reportToMarkdown(report({ content: null }), "Zephyr")).toBeNull()
    })

    it("refuses an unknown report type rather than emitting an empty document", () => {
        expect(
            reportToMarkdown(report({ type: "SOMETHING_NEW" }), "Zephyr"),
        ).toBeNull()
    })

    describe("fundability", () => {
        const md = reportToMarkdown(
            report({
                content: {
                    total_score: 72,
                    breakdown: {
                        market_opportunity: 8,
                        product_solution: 7,
                        traction_execution: 6,
                        team: 7,
                        moat_risks: 8,
                    },
                    summary: "Real moat, concentrated revenue.",
                    green_flags: ["BRP licence takes 12+ months to replicate."],
                    red_flags: ["Three customers are most of revenue."],
                },
            }),
            "Zephyr Grid",
        )!

        it("leads with the company and the score", () => {
            expect(md).toContain("# Fundability — Zephyr Grid")
            expect(md).toContain("**72 / 100**")
        })

        it("renders the breakdown as a table", () => {
            expect(md).toContain("| Criterion | Score |")
            expect(md).toContain("| Market opportunity | 8 / 10 |")
            expect(md).toContain("| Moat / risks | 8 / 10 |")
        })

        it("keeps both flag lists", () => {
            expect(md).toContain("## Green flags")
            expect(md).toContain("- BRP licence takes 12+ months to replicate.")
            expect(md).toContain("## Red flags")
            expect(md).toContain("- Three customers are most of revenue.")
        })

        it("never leaves a literal undefined in the output", () => {
            expect(md).not.toMatch(/undefined|\[object Object\]|NaN/)
        })
    })

    it("marks empty flag lists rather than emitting a bare heading", () => {
        const md = reportToMarkdown(
            report({ content: { total_score: 12, green_flags: [], red_flags: [] } }),
            "Thin Co",
        )!

        // A heading followed by nothing reads as a rendering bug.
        expect(md).toContain("_None._")
    })

    it("omits the breakdown table when there is no breakdown", () => {
        const md = reportToMarkdown(report({ content: { total_score: 40 } }), "Thin Co")!

        expect(md).not.toContain("| Criterion |")
        expect(md).toContain("**40 / 100**")
    })

    describe("memo", () => {
        const md = reportToMarkdown(
            report({
                type: "INVESTMENT_MEMO",
                content: {
                    recommendation: "Investigate",
                    sections: [
                        { title: "Executive Summary", content: "Worth a second call." },
                        { title: "The Ask", content: "$4.5M on a $22M cap." },
                    ],
                },
            }),
            "Zephyr Grid",
        )!

        it("carries the recommendation and every section", () => {
            expect(md).toContain("**Recommendation: Investigate**")
            expect(md).toContain("## Executive Summary")
            expect(md).toContain("Worth a second call.")
            expect(md).toContain("## The Ask")
        })

        it("preserves dollar figures verbatim", () => {
            expect(md).toContain("$4.5M on a $22M cap.")
        })
    })

    describe("deck", () => {
        const md = reportToMarkdown(
            report({
                type: "PITCH_DECK",
                content: {
                    title: "Zephyr Grid",
                    subtitle: "Battery arbitrage, automated",
                    slides: [
                        {
                            title: "The Problem",
                            bullets: ["Bidding is manual.", "Revenue is lost."],
                            speaker_notes: "Open with the number.",
                        },
                        { title: "The Ask", bullets: ["$4.5M seed."], speaker_notes: "" },
                    ],
                },
            }),
            "Zephyr Grid",
        )!

        it("numbers the slides", () => {
            expect(md).toContain("## 1. The Problem")
            expect(md).toContain("## 2. The Ask")
        })

        it("separates slides with a rule so it drops into Marp unchanged", () => {
            // One rule between the two slides, plus one under the title block.
            expect(md.match(/^---$/gm)?.length).toBe(2)
        })

        it("renders speaker notes as a blockquote, and omits empty ones", () => {
            expect(md).toContain("> Open with the number.")
            expect(md).not.toMatch(/>\s*$/m)
        })
    })
})

describe("investorViewToMarkdown", () => {
    const md = investorViewToMarkdown(
        {
            angle: "Lead with the regulatory moat.",
            sections: [{ title: "Problem", content: "Reframed for infrastructure." }],
            metrics_to_lead_with: ["180MWh under management"],
            talking_points: ["BRP licence is the barrier."],
        },
        "Sequoia",
        "Zephyr Grid",
    )

    it("names both the startup and the investor in the title", () => {
        expect(md).toContain("# Zephyr Grid — prepared for Sequoia")
    })

    it("keeps the angle, metrics and talking points", () => {
        expect(md).toContain("**The angle:** Lead with the regulatory moat.")
        expect(md).toContain("- 180MWh under management")
        expect(md).toContain("- BRP licence is the barrier.")
    })
})

describe("slugify", () => {
    it.each([
        ["Zephyr Grid", "zephyr-grid"],
        ["Acme  Robotics!!", "acme-robotics"],
        ["  leading and trailing  ", "leading-and-trailing"],
        ["Ünïcodé Çø", "n-cod"],
        ["...", "nodeck"],
        ["", "nodeck"],
    ])("%s -> %s", (input, expected) => {
        expect(slugify(input)).toBe(expected)
    })

    it("never emits a name that would be rejected by a filesystem", () => {
        expect(slugify('a/b\\c:d*e?f"g<h>i|j')).not.toMatch(/[/\\:*?"<>|]/)
    })

    it("bounds the length", () => {
        expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(60)
    })
})

describe("filenameFor", () => {
    it("encodes company, kind and date", () => {
        expect(filenameFor(report(), "Zephyr Grid")).toBe(
            "zephyr-grid-fundability-2026-08-24.md",
        )
    })

    it.each([
        ["INVESTMENT_MEMO", "memo"],
        ["PITCH_DECK", "deck"],
        ["MYSTERY", "report"],
    ])("%s -> %s", (type, suffix) => {
        expect(filenameFor(report({ type }), "Co")).toContain(`-${suffix}-`)
    })
})
