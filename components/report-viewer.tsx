"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { FundabilityAnalysis, Report } from "@/lib/types"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

const BREAKDOWN_LABELS: [keyof FundabilityAnalysis["breakdown"], string][] = [
    ["market_opportunity", "Market opportunity"],
    ["product_solution", "Product / solution"],
    ["traction_execution", "Traction / execution"],
    ["team", "Team"],
    ["moat_risks", "Moat / risks"],
]

function scoreColor(score: number) {
    if (score >= 80) return "text-success"
    if (score >= 50) return "text-warning"
    return "text-destructive"
}

function barColor(score: number) {
    if (score >= 8) return "bg-success"
    if (score >= 5) return "bg-warning"
    return "bg-destructive"
}

export function ReportViewer({ report }: { report: Report }) {
    if (report.status === "PENDING") {
        return (
            <Card>
                <CardContent className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysis in progress. This usually takes under two minutes.
                </CardContent>
            </Card>
        )
    }

    if (report.status === "FAILED") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-destructive">Analysis failed</CardTitle>
                    <CardDescription>
                        {report.content?.error ?? "Something went wrong. Try running it again."}
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    // Postgres JSONB can come back double-encoded in some drivers; cheap to guard.
    const raw = report.content
    const content = (typeof raw === "string" ? JSON.parse(raw) : raw) as
        | Partial<FundabilityAnalysis>
        | null
        | undefined

    if (!content || typeof content.total_score !== "number") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Report unavailable</CardTitle>
                    <CardDescription>This report has no readable content.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const breakdown = content.breakdown
    const greenFlags = content.green_flags ?? []
    const redFlags = content.red_flags ?? []

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Fundability Score</CardTitle>
                    <CardDescription>
                        Scored as a general partner would: 30 is average, 70 is Series A ready.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
                    <div className="text-center">
                        <div className={`text-6xl font-bold ${scoreColor(content.total_score)}`}>
                            {content.total_score}
                        </div>
                        <div className="text-sm text-muted-foreground">out of 100</div>
                    </div>

                    {breakdown && (
                        <div className="grid gap-3">
                            {BREAKDOWN_LABELS.map(([key, label]) => {
                                const value = breakdown[key] ?? 0
                                return (
                                    <div key={key} className="grid gap-1">
                                        <div className="flex items-baseline justify-between text-sm">
                                            <span>{label}</span>
                                            <span className="tabular-nums text-muted-foreground">
                                                {value} / 10
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={`h-full rounded-full ${barColor(value)}`}
                                                style={{ width: `${Math.max(0, Math.min(10, value)) * 10}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            Green flags
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {greenFlags.length === 0 ? (
                            <p className="text-sm text-muted-foreground">None identified.</p>
                        ) : (
                            <ul className="list-disc space-y-1 pl-4">
                                {greenFlags.map((flag, i) => (
                                    <li key={i} className="text-sm">{flag}</li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            Red flags
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {redFlags.length === 0 ? (
                            <p className="text-sm text-muted-foreground">None identified.</p>
                        ) : (
                            <ul className="list-disc space-y-1 pl-4">
                                {redFlags.map((flag, i) => (
                                    <li key={i} className="text-sm">{flag}</li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            {content.summary && (
                <Card>
                    <CardHeader>
                        <CardTitle>Executive summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {content.summary}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
