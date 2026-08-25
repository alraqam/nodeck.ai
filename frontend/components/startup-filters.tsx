"use client"

import { Input } from "@/components/ui/input"
import type { StartupSummary } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"

export type SortKey = "recent" | "score" | "name"

const SORTS: { key: SortKey; label: string }[] = [
    { key: "recent", label: "Newest" },
    { key: "score", label: "Score" },
    { key: "name", label: "Name" },
]

/**
 * Filtering and sorting happen in the browser.
 *
 * The list endpoint returns a founder's own startups, which is a handful, not
 * a feed - paginating and re-querying the server for that would add latency
 * and a loading state to something that can be instant. Revisit if anyone ever
 * has hundreds.
 */
export function filterAndSort(
    startups: StartupSummary[],
    query: string,
    sort: SortKey,
): StartupSummary[] {
    const q = query.trim().toLowerCase()

    const matched = q
        ? startups.filter((s) =>
              [s.name, s.one_liner, s.stage, ...(s.industry ?? [])]
                  .filter(Boolean)
                  .some((field) => String(field).toLowerCase().includes(q)),
          )
        : startups

    // Sort a copy: the array belongs to the caller's state, and sorting it in
    // place would mutate state React believes it owns.
    return [...matched].sort((a, b) => {
        if (sort === "name") {
            return (a.name ?? "").localeCompare(b.name ?? "")
        }
        if (sort === "score") {
            // Unscored profiles sort last rather than as zero - "not measured"
            // is not the same as "measured badly".
            const av = a.latest_score ?? -1
            const bv = b.latest_score ?? -1
            if (av !== bv) return bv - av
        }
        return +new Date(b.created_at) - +new Date(a.created_at)
    })
}

export function StartupFilters({
    query,
    onQueryChange,
    sort,
    onSortChange,
    total,
    shown,
}: {
    query: string
    onQueryChange: (value: string) => void
    sort: SortKey
    onSortChange: (value: SortKey) => void
    total: number
    shown: number
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    type="search"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search name, one-liner, stage or industry"
                    aria-label="Search profiles"
                    className="pl-8"
                />
            </div>

            <div
                role="group"
                aria-label="Sort profiles"
                className="flex items-center gap-1"
            >
                {SORTS.map((s) => (
                    <button
                        key={s.key}
                        type="button"
                        onClick={() => onSortChange(s.key)}
                        aria-pressed={sort === s.key}
                        className={cn(
                            "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                            sort === s.key
                                ? "bg-secondary font-medium text-secondary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Announced politely so a screen reader hears the count change as
                the query is typed, without interrupting the typing itself. */}
            <p
                aria-live="polite"
                className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground"
            >
                {shown === total ? `${total} total` : `${shown} of ${total}`}
            </p>
        </div>
    )
}
