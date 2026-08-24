"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { Report, ScoreBreakdown } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

const CRITERIA: [keyof ScoreBreakdown, string][] = [
    ["market_opportunity", "Market"],
    ["product_solution", "Product"],
    ["traction_execution", "Traction"],
    ["team", "Team"],
    ["moat_risks", "Moat"],
]

type Scored = { score: number; breakdown?: ScoreBreakdown; at: string }

/** Completed fundability runs, oldest first. */
function history(reports: Report[]): Scored[] {
    return reports
        .filter(
            (r) =>
                r.type === "FUNDABILITY_SCORE" &&
                r.status === "COMPLETED" &&
                typeof r.score_summary?.total_score === "number",
        )
        .map((r) => ({
            score: r.score_summary!.total_score!,
            breakdown: r.score_summary!.breakdown,
            at: r.created_at,
        }))
        .sort((a, b) => +new Date(a.at) - +new Date(b.at))
}

const tone = (n: number) =>
    n > 0 ? "text-score-high" : n < 0 ? "text-score-low" : "text-muted-foreground"

function Delta({ value, className }: { value: number; className?: string }) {
    const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus
    return (
        <span className={cn("inline-flex items-center gap-0.5 tabular", tone(value), className)}>
            <Icon className="h-3 w-3" />
            {value === 0 ? "0" : Math.abs(value)}
        </span>
    )
}

/**
 * The improve-then-rescore loop is the point of the product, so a second run
 * has to answer "did that help?" without the founder diffing two reports by
 * eye. Renders nothing until there are at least two runs to compare.
 */
export function ScoreTrend({ reports }: { reports: Report[] }) {
    const runs = history(reports)
    if (runs.length < 2) return null

    const latest = runs[runs.length - 1]
    const previous = runs[runs.length - 2]
    const delta = latest.score - previous.score

    const best = Math.max(...runs.map((r) => r.score))
    const worst = Math.min(...runs.map((r) => r.score))
    // Guard the zero-range case: every run scoring the same would divide by 0
    // and collapse the chart to NaN heights.
    const span = Math.max(best - worst, 1)

    return (
        <Card>
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[auto_1fr] lg:gap-10">
                <div className="space-y-3">
                    <span className="eyebrow">Since last run</span>
                    <div className="flex items-baseline gap-2">
                        <span
                            className={cn(
                                "font-mono text-4xl font-semibold leading-none tabular",
                                tone(delta),
                            )}
                        >
                            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                            {Math.abs(delta)}
                        </span>
                        <span className="font-mono text-sm text-muted-foreground">
                            {previous.score} → {latest.score}
                        </span>
                    </div>
                    <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                        {delta > 0
                            ? "Your changes moved the score up. Keep going."
                            : delta < 0
                                ? "The score went down. Check the red flags below."
                                : "No movement. The gaps the partner named are still open."}
                    </p>
                </div>

                <div className="space-y-5">
                    {/* Column chart rather than a line: the runs are discrete
                        events, not a continuous series over time. */}
                    <div className="space-y-2">
                        <div className="flex items-end gap-1.5" style={{ height: "3.5rem" }}>
                            {runs.map((run, i) => {
                                const isLast = i === runs.length - 1
                                return (
                                    <div
                                        key={run.at + i}
                                        title={`${run.score}/100 — ${new Date(run.at).toLocaleDateString()}`}
                                        style={{
                                            height: `${20 + ((run.score - worst) / span) * 80}%`,
                                        }}
                                        className={cn(
                                            "min-w-1.5 flex-1 rounded-[2px] transition-colors",
                                            isLast ? "bg-primary" : "bg-muted-foreground/25",
                                        )}
                                    />
                                )
                            })}
                        </div>
                        <div className="flex justify-between font-mono text-[0.6875rem] text-muted-foreground/70">
                            <span>
                                {runs.length} run{runs.length === 1 ? "" : "s"}
                            </span>
                            <span>best {best}</span>
                        </div>
                    </div>

                    {latest.breakdown && previous.breakdown && (
                        <div className="space-y-2">
                            <span className="eyebrow">What moved</span>
                            <div className="flex flex-wrap gap-x-5 gap-y-2">
                                {CRITERIA.map(([key, label]) => {
                                    const change =
                                        (latest.breakdown![key] ?? 0) - (previous.breakdown![key] ?? 0)
                                    return (
                                        <span key={key} className="flex items-center gap-1.5 text-sm">
                                            <span className="text-muted-foreground">{label}</span>
                                            <Delta value={change} className="font-mono text-xs" />
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
