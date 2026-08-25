import { describe, expect, it } from "vitest"
import { filterAndSort } from "./startup-filters"
import type { StartupSummary } from "@/lib/types"

const make = (
    name: string,
    overrides: Partial<StartupSummary> = {},
): StartupSummary => ({
    id: name,
    name,
    one_liner: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
})

const ZEPHYR = make("Zephyr Grid", {
    one_liner: "Battery arbitrage, automated",
    stage: "SEED",
    industry: ["Energy", "Climate"],
    latest_score: 72,
    created_at: "2026-03-01T00:00:00Z",
})
const ACME = make("Acme Robotics", {
    one_liner: "Warehouse robots as a service",
    stage: "PRE_SEED",
    industry: ["Robotics"],
    latest_score: 41,
    created_at: "2026-01-01T00:00:00Z",
})
const UNSCORED = make("Nimbus", {
    stage: "SEED",
    created_at: "2026-02-01T00:00:00Z",
})

const ALL = [ZEPHYR, ACME, UNSCORED]
const names = (list: StartupSummary[]) => list.map((s) => s.name)

describe("filterAndSort — filtering", () => {
    it("returns everything for an empty query", () => {
        expect(filterAndSort(ALL, "", "recent")).toHaveLength(3)
    })

    it.each([
        ["zephyr", "name"],
        ["warehouse", "one-liner"],
        ["climate", "industry"],
        ["pre_seed", "stage"],
    ])("matches on %s (%s)", (query) => {
        expect(filterAndSort(ALL, query, "recent").length).toBeGreaterThan(0)
    })

    it("is case insensitive", () => {
        expect(names(filterAndSort(ALL, "ZEPHYR", "recent"))).toEqual(["Zephyr Grid"])
    })

    it("ignores surrounding whitespace", () => {
        expect(names(filterAndSort(ALL, "  acme  ", "recent"))).toEqual(["Acme Robotics"])
    })

    it("returns nothing when nothing matches", () => {
        expect(filterAndSort(ALL, "quantum ferrets", "recent")).toEqual([])
    })

    it("tolerates missing fields", () => {
        // A profile with no one-liner or industry must not throw on search.
        expect(() => filterAndSort([make("Bare")], "anything", "recent")).not.toThrow()
    })
})

describe("filterAndSort — sorting", () => {
    it("sorts by newest first", () => {
        expect(names(filterAndSort(ALL, "", "recent"))).toEqual([
            "Zephyr Grid",
            "Nimbus",
            "Acme Robotics",
        ])
    })

    it("sorts by score, highest first", () => {
        expect(names(filterAndSort(ALL, "", "score")).slice(0, 2)).toEqual([
            "Zephyr Grid",
            "Acme Robotics",
        ])
    })

    it("puts unscored profiles last rather than treating them as zero", () => {
        // "Not measured" is not the same as "measured badly": an unscored
        // profile must not outrank a genuinely low score.
        expect(names(filterAndSort(ALL, "", "score")).at(-1)).toBe("Nimbus")
    })

    it("sorts by name alphabetically", () => {
        expect(names(filterAndSort(ALL, "", "name"))).toEqual([
            "Acme Robotics",
            "Nimbus",
            "Zephyr Grid",
        ])
    })

    it("does not mutate the input array", () => {
        const original = [...ALL]
        filterAndSort(ALL, "", "name")
        expect(ALL).toEqual(original)
    })

    it("falls back to recency when scores are equal", () => {
        const a = make("A", { latest_score: 50, created_at: "2026-01-01T00:00:00Z" })
        const b = make("B", { latest_score: 50, created_at: "2026-06-01T00:00:00Z" })
        expect(names(filterAndSort([a, b], "", "score"))).toEqual(["B", "A"])
    })
})
