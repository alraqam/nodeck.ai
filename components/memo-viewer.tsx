"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { InvestmentMemo, Report } from "@/lib/types"
import { TriangleAlert } from "lucide-react"

/** "Pass" is a real verdict, not an error - colour it as a low score rather
 *  than as a failure, and treat anything else as the positive case. */
function recommendationVariant(recommendation: string) {
    return recommendation.trim().toLowerCase().startsWith("pass") ? "low" : "high"
}

export function MemoViewer({ report }: { report: Report }) {
    if (report.status === "PENDING") return <MemoSkeleton />

    if (report.status === "FAILED") {
        return (
            <Card className="border-destructive/30">
                <CardContent className="flex items-start gap-3 p-5">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Memo generation failed</p>
                        <p className="text-sm text-muted-foreground">
                            {report.content?.error ?? "Something went wrong. Run it again."}
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const memo = report.content as Partial<InvestmentMemo> | null | undefined
    const sections = memo?.sections ?? []

    if (!sections.length) {
        return (
            <Card>
                <CardContent className="p-5 text-sm text-muted-foreground">
                    This memo has no readable content.
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6">
                    <div>
                        <span className="eyebrow">Investment memo</span>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                            Written as an associate would for a partnership meeting.
                        </p>
                    </div>
                    {memo?.recommendation && (
                        <Badge variant={recommendationVariant(memo.recommendation)}>
                            {memo.recommendation}
                        </Badge>
                    )}
                </div>

                {/* Numbered like a real memo so sections can be referred to aloud. */}
                <ol className="divide-y">
                    {sections.map((section, i) => (
                        <li key={i} className="grid gap-3 p-6 sm:grid-cols-[3rem_1fr] sm:gap-6">
                            <span className="font-mono text-xs text-primary">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 space-y-2">
                                <h3 className="font-semibold tracking-tight">{section.title}</h3>
                                <div className="max-w-3xl whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted-foreground">
                                    {section.content}
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    )
}

function MemoSkeleton() {
    return (
        <Card>
            <CardContent className="space-y-6 p-6">
                <Skeleton className="h-3 w-40" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-11/12" />
                        <Skeleton className="h-3 w-3/4" />
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
