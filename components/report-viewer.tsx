"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "lucide-react"

interface FundabilityAnalysis {
    total_score: number
    breakdown: {
        market_opportunity: number
        product_solution: number
        traction_execution: number
        team: number
        moat_risks: number
    }
    summary: string
    red_flags: string[]
    green_flags: string[]
}

interface ReportViewerProps {
    report: any // Type this better with shared types
}

export function ReportViewer({ report }: ReportViewerProps) {
    if (report.type !== "FUNDABILITY_SCORE") return <div>Unsupported report type</div>

    // Parse content if it's a string (Postgres JSONB sometimes returns string if double encoded)
    const content: FundabilityAnalysis = typeof report.content === 'string' ? JSON.parse(report.content) : report.content

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-500"
        if (score >= 50) return "text-yellow-500"
        return "text-red-500"
    }

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Fundability Score</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <div className={`text-6xl font-bold ${getScoreColor(content.total_score)}`}>
                            {content.total_score}
                        </div>
                    </div>
                    <div className="text-center text-muted-foreground">
                        / 100
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Green Flags</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc pl-4 space-y-1">
                            {content.green_flags.map((flag, i) => (
                                <li key={i} className="text-sm text-green-600">{flag}</li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Red Flags</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc pl-4 space-y-1">
                            {content.red_flags.map((flag, i) => (
                                <li key={i} className="text-sm text-red-600">{flag}</li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Executive Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {content.summary}
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
