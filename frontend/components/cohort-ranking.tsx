"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, ApiError } from "@/lib/api"
import type { CohortRow, OutcomeStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ChevronDown, Loader2 } from "lucide-react"

const BANDS = ["70+", "50-69", "30-49", "under 30", "unscored"] as const

const OUTCOMES: { value: OutcomeStatus; label: string }[] = [
    { value: "UNKNOWN", label: "Unknown" },
    { value: "RAISING", label: "Raising" },
    { value: "RAISED", label: "Raised" },
    { value: "FAILED", label: "Failed" },
    { value: "INACTIVE", label: "Inactive" },
]

const tone = (score?: number | null) =>
    score == null
        ? "text-muted-foreground"
        : score >= 70
            ? "text-score-high"
            : score >= 45
                ? "text-score-mid"
                : "text-score-low"

const bandTone: Record<string, string> = {
    "70+": "bg-score-high",
    "50-69": "bg-score-mid",
    "30-49": "bg-score-low",
    "under 30": "bg-score-low",
    unscored: "bg-muted-foreground/30",
}

const money = (n?: number | null) =>
    n == null
        ? null
        : new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              notation: n >= 1_000_000 ? "compact" : "standard",
              maximumFractionDigits: 1,
          }).format(n)

export function CohortRanking({
    rows,
    distribution,
    onOutcomeSaved,
}: {
    rows: CohortRow[]
    distribution: Record<string, number>
    onOutcomeSaved: () => void
}) {
    const [open, setOpen] = useState<string | null>(null)

    if (!rows.length) {
        return (
            <Card>
                <CardContent className="p-8 text-sm text-muted-foreground">
                    No decks imported yet. Use the Import decks tab.
                </CardContent>
            </Card>
        )
    }

    const total = rows.length

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="space-y-3 p-5">
                    <span className="eyebrow">Distribution</span>
                    {/* One bar rather than a chart: the question is what shape the
                        intake is, not the exact counts. */}
                    <div className="flex h-2 overflow-hidden rounded-full">
                        {BANDS.map((band) =>
                            distribution[band] ? (
                                <div
                                    key={band}
                                    className={bandTone[band]}
                                    style={{ width: `${(distribution[band] / total) * 100}%` }}
                                    title={`${band}: ${distribution[band]}`}
                                />
                            ) : null,
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {BANDS.filter((b) => distribution[b]).map((band) => (
                            <span key={band} className="flex items-center gap-1.5 text-xs">
                                <span className={cn("h-2 w-2 rounded-full", bandTone[band])} />
                                <span className="text-muted-foreground">{band}</span>
                                <span className="font-mono tabular">{distribution[band]}</span>
                            </span>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Cards, not a table. A ranking table is the widest thing in the app
                and would force the page to scroll sideways on a phone. */}
            <div className="space-y-2">
                {rows.map((row, index) => (
                    <Card key={row.startup_id}>
                        <CardContent className="p-0">
                            <button
                                type="button"
                                onClick={() => setOpen(open === row.startup_id ? null : row.startup_id)}
                                className="flex w-full items-center gap-4 p-4 text-left"
                                aria-expanded={open === row.startup_id}
                            >
                                <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <span
                                    className={cn(
                                        "w-12 shrink-0 font-mono text-2xl leading-none tabular",
                                        tone(row.total_score),
                                    )}
                                >
                                    {row.total_score ?? "--"}
                                </span>
                                <span className="min-w-0 flex-1 space-y-0.5">
                                    <span className="block truncate font-medium">{row.name}</span>
                                    <span className="block truncate text-sm text-muted-foreground">
                                        {row.status === "COMPLETED"
                                            ? row.one_liner || "No one-liner"
                                            : row.status === "PENDING"
                                                ? "Scoring…"
                                                : row.error || row.status}
                                    </span>
                                </span>
                                <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                                    {row.stage && (
                                        <Badge variant="outline">{row.stage.replace(/_/g, " ")}</Badge>
                                    )}
                                    {row.confidence && (
                                        <Badge variant={row.confidence === "LOW" ? "low" : "default"}>
                                            {row.confidence}
                                        </Badge>
                                    )}
                                    {row.outcome_status && row.outcome_status !== "UNKNOWN" && (
                                        <Badge variant={row.outcome_status === "RAISED" ? "high" : "outline"}>
                                            {row.outcome_status === "RAISED" && row.raised_amount
                                                ? money(row.raised_amount)
                                                : row.outcome_status}
                                        </Badge>
                                    )}
                                </span>
                                {row.status === "PENDING" ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                                ) : (
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                            open === row.startup_id && "rotate-180",
                                        )}
                                    />
                                )}
                            </button>

                            {open === row.startup_id && (
                                <div className="space-y-5 border-t p-4">
                                    {!!row.top_fixes.length && (
                                        <div className="space-y-2">
                                            <span className="eyebrow">What would move this most</span>
                                            <ol className="space-y-1.5">
                                                {row.top_fixes.map((fix, i) => (
                                                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                                                        <span className="font-mono text-xs text-primary">
                                                            {i + 1}
                                                        </span>
                                                        <span className="text-muted-foreground">{fix}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}

                                    <OutcomeEditor row={row} onSaved={onOutcomeSaved} />

                                    <Link
                                        href={`/dashboard/startups/${row.startup_id}`}
                                        className="inline-block text-sm text-primary underline underline-offset-4"
                                    >
                                        Open the full profile
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

/** Recording what happened is the point of the dataset, so it lives inline on
 *  the row rather than behind another page. */
function OutcomeEditor({ row, onSaved }: { row: CohortRow; onSaved: () => void }) {
    const [status, setStatus] = useState<OutcomeStatus>(row.outcome_status ?? "UNKNOWN")
    const [amount, setAmount] = useState(
        row.raised_amount != null ? String(row.raised_amount) : "",
    )
    const [saving, setSaving] = useState(false)

    async function save() {
        setSaving(true)
        try {
            const parsed = amount.trim() ? Number(amount) : null
            await api.saveOutcome(row.startup_id, {
                status,
                // Only send an amount when they actually raised: a figure
                // attached to RAISING or FAILED would be meaningless in the export.
                raised_amount:
                    status === "RAISED" && parsed != null && Number.isFinite(parsed)
                        ? parsed
                        : null,
            })
            toast.success("Outcome recorded")
            onSaved()
        } catch (e) {
            toast.error("Could not save outcome", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-2">
            <span className="eyebrow">Outcome</span>
            <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-wrap gap-1.5">
                    {OUTCOMES.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setStatus(o.value)}
                            aria-pressed={status === o.value}
                            className={cn(
                                "rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                                status === o.value
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
                {status === "RAISED" && (
                    <div className="grid gap-1.5">
                        <Label htmlFor={`amt-${row.startup_id}`} className="text-xs">
                            Amount (USD)
                        </Label>
                        <Input
                            id={`amt-${row.startup_id}`}
                            type="number"
                            className="w-40"
                            placeholder="4500000"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                )}
                <Button size="sm" onClick={save} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Save
                </Button>
            </div>
        </div>
    )
}
