"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { FundabilityAnalysis, Report } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AlertTriangle, ArrowUpRight, TriangleAlert } from "lucide-react"

const BREAKDOWN: [keyof FundabilityAnalysis["breakdown"], string, string][] = [
    ["market_opportunity", "Market", "Is the TAM credibly north of $1B?"],
    ["product_solution", "Product", "Differentiation of the solution itself."],
    ["traction_execution", "Traction", "Evidence the team ships and customers care."],
    ["team", "Team", "Founder-market fit, not resumes."],
    ["moat_risks", "Moat", "What stops a funded competitor copying this?"],
]

/** Verdict language mirrors the calibration given to the model in the system
 *  prompt, so the UI never contradicts the analysis. */
function verdict(score: number) {
    if (score >= 90) return { label: "Generational", tier: "high" as const }
    if (score >= 70) return { label: "Series A ready", tier: "high" as const }
    if (score >= 50) return { label: "Promising", tier: "mid" as const }
    if (score >= 30) return { label: "Average applicant", tier: "mid" as const }
    return { label: "Below the bar", tier: "low" as const }
}

const tierText = {
    low: "text-score-low",
    mid: "text-score-mid",
    high: "text-score-high",
} as const

const tierBg = {
    low: "bg-score-low",
    mid: "bg-score-mid",
    high: "bg-score-high",
} as const

const tierOf = (n: number, max: number) => {
    const pct = n / max
    if (pct >= 0.7) return "high" as const
    if (pct >= 0.45) return "mid" as const
    return "low" as const
}

export function ReportViewer({ report }: { report: Report }) {
    if (report.status === "PENDING") return <PendingReport />

    if (report.status === "FAILED") {
        return (
            <Card className="border-destructive/30">
                <CardContent className="flex items-start gap-3 p-5">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Analysis failed</p>
                        <p className="text-sm text-muted-foreground">
                            {report.content?.error ?? "Something went wrong. Run it again."}
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Some drivers hand back double-encoded JSONB; cheap to guard.
    const raw = report.content
    const content = (typeof raw === "string" ? JSON.parse(raw) : raw) as
        | Partial<FundabilityAnalysis>
        | null
        | undefined

    if (!content || typeof content.total_score !== "number") {
        return (
            <Card>
                <CardContent className="p-5 text-sm text-muted-foreground">
                    This report has no readable content.
                </CardContent>
            </Card>
        )
    }

    const score = content.total_score
    const v = verdict(score)
    const breakdown = content.breakdown
    const green = content.green_flags ?? []
    const red = content.red_flags ?? []

    return (
        <div className="space-y-4">
            {/* Hero: the score is the product. Give it the whole width and let
                everything else defer to it. */}
            <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.18]" />
                <CardContent className="relative grid gap-8 p-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-12">
                    <div className="flex flex-col justify-center">
                        <span className="eyebrow">Fundability</span>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span
                                className={cn(
                                    "font-mono text-7xl font-semibold leading-none tabular tracking-tighter",
                                    tierText[v.tier],
                                )}
                            >
                                {score}
                            </span>
                            <span className="font-mono text-2xl leading-none text-muted-foreground">
                                /100
                            </span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Badge variant={v.tier}>{v.label}</Badge>
                            {content.confidence && (
                                // Confidence is about the evidence, not the verdict:
                                // a thin profile scored low is still a confident low.
                                <Badge
                                    variant={content.confidence === "LOW" ? "low" : "outline"}
                                    title="How much of your profile was actually evidenced"
                                >
                                    {content.confidence} evidence
                                </Badge>
                            )}
                        </div>
                        <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground">
                            Scored by a general partner who assumes you will fail. 30 is the
                            average applicant, 70 is Series A ready.
                        </p>
                    </div>

                    {breakdown && (
                        <div className="flex flex-col justify-center gap-4">
                            <span className="eyebrow">Breakdown</span>
                            <div className="grid gap-3.5">
                                {BREAKDOWN.map(([key, label, hint]) => {
                                    const value = breakdown[key] ?? 0
                                    const tier = tierOf(value, 10)
                                    return (
                                        <div key={key} className="grid gap-1.5">
                                            <div className="flex items-baseline justify-between gap-4">
                                                <span className="text-sm font-medium">{label}</span>
                                                <span
                                                    className={cn(
                                                        "font-mono text-sm tabular",
                                                        tierText[tier],
                                                    )}
                                                >
                                                    {value}
                                                    <span className="text-muted-foreground">/10</span>
                                                </span>
                                            </div>
                                            {/* Ten discrete cells, not a continuous bar: the score is
                                                an integer out of ten and should look like one. */}
                                            <div className="flex gap-[3px]">
                                                {Array.from({ length: 10 }, (_, i) => (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            "h-1.5 flex-1 rounded-[1px]",
                                                            i < value ? tierBg[tier] : "bg-muted",
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{hint}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {!!content.top_fixes?.length && (
                <Card>
                    <CardContent className="space-y-3 p-6">
                        <span className="eyebrow">What would move this most</span>
                        <ol className="space-y-2.5">
                            {content.top_fixes.map((fix, i) => (
                                <li key={i} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                                    <span className="font-mono text-sm text-primary">{i + 1}</span>
                                    <span>{fix}</span>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            )}

            {content.summary && (
                <Card>
                    <CardContent className="space-y-3 p-6">
                        <span className="eyebrow">Partner note</span>
                        <p className="max-w-3xl whitespace-pre-wrap text-[0.9375rem] leading-relaxed">
                            {content.summary}
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <FlagList
                    title="Green flags"
                    tone="high"
                    icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                    items={green}
                    empty="No strengths surfaced. That is itself a signal."
                />
                <FlagList
                    title="Red flags"
                    tone="low"
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    items={red}
                    empty="No risks surfaced."
                />
            </div>
        </div>
    )
}

function FlagList({
    title,
    tone,
    icon,
    items,
    empty,
}: {
    title: string
    tone: "high" | "low"
    icon: React.ReactNode
    items: string[]
    empty: string
}) {
    return (
        <Card>
            <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <span className="eyebrow">{title}</span>
                    <span className={cn("font-mono text-xs tabular", tierText[tone])}>
                        {String(items.length).padStart(2, "0")}
                    </span>
                </div>
                {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{empty}</p>
                ) : (
                    <ul className="space-y-3">
                        {items.map((flag, i) => (
                            <li key={i} className="flex gap-3 text-sm leading-relaxed">
                                <span className={cn("mt-1 shrink-0", tierText[tone])}>{icon}</span>
                                <span>{flag}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}

function PendingReport() {
    return (
        <div className="space-y-4">
            <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.18]" />
                <CardContent className="relative grid gap-8 p-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-12">
                    <div className="flex flex-col justify-center">
                        <span className="eyebrow">Fundability</span>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="animate-pulse font-mono text-7xl font-semibold leading-none tracking-tighter text-muted-foreground/25">
                                --
                            </span>
                            <span className="font-mono text-2xl leading-none text-muted-foreground/30">
                                /100
                            </span>
                        </div>
                        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                            Reading your profile. This usually takes under two minutes.
                        </p>
                    </div>
                    <div className="flex flex-col justify-center gap-4">
                        <span className="eyebrow">Breakdown</span>
                        <div className="grid gap-4">
                            {BREAKDOWN.map(([key]) => (
                                <div key={key} className="grid gap-2">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-1.5 w-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
