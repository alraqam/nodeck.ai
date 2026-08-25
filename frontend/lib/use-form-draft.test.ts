import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * These exercise the storage contract the hook depends on, without a DOM
 * renderer: what counts as a restorable draft, and what must be thrown away
 * rather than shown to someone. Restoring the wrong thing over good answers is
 * worse than losing a draft, so the rejection cases are the point.
 */

const PREFIX = "nodeck:draft:"
const VERSION = 1
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

// Mirrors the read path in use-form-draft.ts.
function read<T>(key: string): { version: number; savedAt: number; values: T } | null {
    try {
        const raw = globalThis.localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (parsed.version !== VERSION) return null
        if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null
        return parsed
    } catch {
        return null
    }
}

function store(key: string, payload: unknown) {
    globalThis.localStorage.setItem(key, JSON.stringify(payload))
}

beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal("localStorage", {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => data.set(k, v),
        removeItem: (k: string) => data.delete(k),
        clear: () => data.clear(),
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe("draft storage", () => {
    const key = `${PREFIX}startup-1`

    it("returns a current draft", () => {
        store(key, { version: VERSION, savedAt: Date.now(), values: { a: 1 } })

        expect(read<{ a: number }>(key)?.values).toEqual({ a: 1 })
    })

    it("returns nothing when there is no draft", () => {
        expect(read(key)).toBeNull()
    })

    it("rejects a draft written by an older shape", () => {
        // Restoring these into a form whose fields have changed would put
        // values in the wrong places, or silently drop them.
        store(key, { version: VERSION - 1, savedAt: Date.now(), values: { a: 1 } })

        expect(read(key)).toBeNull()
    })

    it("rejects a draft older than the retention window", () => {
        store(key, {
            version: VERSION,
            savedAt: Date.now() - MAX_AGE_MS - 1000,
            values: { a: 1 },
        })

        expect(read(key)).toBeNull()
    })

    it("keeps a draft that is just inside the window", () => {
        store(key, {
            version: VERSION,
            savedAt: Date.now() - MAX_AGE_MS + 60_000,
            values: { a: 1 },
        })

        expect(read(key)).not.toBeNull()
    })

    it("survives corrupt storage rather than throwing", () => {
        globalThis.localStorage.setItem(key, "{not json")

        expect(read(key)).toBeNull()
    })

    it("survives storage that throws on read", () => {
        vi.stubGlobal("localStorage", {
            getItem: () => {
                throw new Error("SecurityError: storage disabled")
            },
        })

        // Private browsing must not take the form down with it.
        expect(read(key)).toBeNull()
    })

    it("keys drafts per startup so profiles cannot collide", () => {
        store(`${PREFIX}one`, { version: VERSION, savedAt: Date.now(), values: { n: "one" } })
        store(`${PREFIX}two`, { version: VERSION, savedAt: Date.now(), values: { n: "two" } })

        expect(read<{ n: string }>(`${PREFIX}one`)?.values.n).toBe("one")
        expect(read<{ n: string }>(`${PREFIX}two`)?.values.n).toBe("two")
    })

    it("is gone after being cleared", () => {
        store(key, { version: VERSION, savedAt: Date.now(), values: { a: 1 } })
        globalThis.localStorage.removeItem(key)

        expect(read(key)).toBeNull()
    })

    it("round-trips the nested shape a profile actually has", () => {
        const values = {
            problem: { description: "Manual bidding", pain_points_str: "slow, costly" },
            team: [{ name: "Vera", role: "CEO" }],
            traction: { metrics: [{ key: "ARR", value: 410000 }] },
        }
        store(key, { version: VERSION, savedAt: Date.now(), values })

        expect(read<typeof values>(key)?.values).toEqual(values)
    })
})
