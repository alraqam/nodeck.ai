"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReportViewer } from "@/components/report-viewer"
import { MemoViewer } from "@/components/memo-viewer"
import { DeckViewer } from "@/components/deck-viewer"
import { InvestorViews } from "@/components/investor-views"
import { DeckUpload } from "@/components/deck-upload"
import { SipSummary } from "@/components/sip-summary"
import { StartupSettings } from "@/components/startup-settings"
import { useReports } from "@/lib/use-reports"
import { api, ApiError } from "@/lib/api"
import type { Report, ReportType, Startup } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowLeft, FileText, Loader2, Pencil, Presentation, Sparkles } from "lucide-react"

export default function StartupDetailPage() {
    const id = String(useParams().id)

    const [startup, setStartup] = useState<Startup | null>(null)
    const [loading, setLoading] = useState(true)
    const { reports, generate, latest, isBusy } = useReports(id)

    const load = useCallback(
        (showError = true) =>
            api
                .getStartup(id)
                .then(setStartup)
                .catch((e) => {
                    if (e instanceof ApiError && e.status === 401) return
                    if (showError) {
                        toast.error(
                            e instanceof ApiError ? e.message : "Could not load this profile",
                        )
                    }
                }),
        [id],
    )

    useEffect(() => {
        load().finally(() => setLoading(false))
    }, [load])

    if (loading) return <DetailSkeleton />
    if (!startup) return <p className="text-sm text-destructive">Profile not found.</p>

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> All profiles
            </Link>

            {/* min-w-0 on the title column is load-bearing: without it the
                buttons win the space fight and the company name wraps mid-word. */}
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-0 flex-1 basis-72">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="truncate text-3xl font-semibold tracking-tight">
                            {startup.name}
                        </h1>
                        {startup.stage && (
                            <Badge variant="outline">{startup.stage.replace(/_/g, " ")}</Badge>
                        )}
                    </div>
                    {startup.one_liner && (
                        <p className="mt-1.5 max-w-2xl text-pretty text-muted-foreground">
                            {startup.one_liner}
                        </p>
                    )}
                    {!!startup.industry?.length && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {startup.industry.map((tag) => (
                                <Badge key={tag} variant="default">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/dashboard/startups/${id}/edit`}>
                        <Button variant="outline">
                            <Pencil className="mr-2 h-4 w-4" /> Edit profile
                        </Button>
                    </Link>
                    <GenerateButton
                        kind="FUNDABILITY_SCORE"
                        icon={<Sparkles className="mr-2 h-4 w-4" />}
                        label="Analyze fundability"
                        busyLabel="Analysing"
                        generate={generate}
                        isBusy={isBusy}
                    />
                </div>
            </div>

            <Tabs defaultValue="score">
                <TabsList>
                    <TabsTrigger value="score">Score</TabsTrigger>
                    <TabsTrigger value="memo">Memo</TabsTrigger>
                    <TabsTrigger value="deck">Deck</TabsTrigger>
                    <TabsTrigger value="investors">Investors</TabsTrigger>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="history">
                        History
                        {reports.length > 0 && (
                            <span className="ml-1.5 font-mono text-[0.6875rem] text-muted-foreground">
                                {reports.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="score" className="mt-6">
                    <ReportPane
                        report={latest("FUNDABILITY_SCORE")}
                        render={(r) => <ReportViewer report={r} />}
                        empty={{
                            eyebrow: "Not scored yet",
                            title: "Find out where you actually stand",
                            body: "A general partner reads the profile and scores it out of 100 — market, moat, team, insight — then names every red flag they see.",
                            action: "Run analysis",
                            icon: <Sparkles className="mr-2 h-4 w-4" />,
                            kind: "FUNDABILITY_SCORE",
                        }}
                        generate={generate}
                        isBusy={isBusy}
                    />
                </TabsContent>

                <TabsContent value="memo" className="mt-6">
                    <ReportPane
                        report={latest("INVESTMENT_MEMO")}
                        render={(r) => <MemoViewer report={r} />}
                        empty={{
                            eyebrow: "No memo yet",
                            title: "See the memo they would write about you",
                            body: "The internal document an associate takes into the Monday partnership meeting — including the recommendation to pass or investigate.",
                            action: "Generate memo",
                            icon: <FileText className="mr-2 h-4 w-4" />,
                            kind: "INVESTMENT_MEMO",
                        }}
                        generate={generate}
                        isBusy={isBusy}
                    />
                </TabsContent>

                <TabsContent value="deck" className="mt-6">
                    <ReportPane
                        report={latest("PITCH_DECK")}
                        render={(r) => <DeckViewer report={r} />}
                        empty={{
                            eyebrow: "No deck yet",
                            title: "The deck, as an output",
                            body: "You did not start from slides. Now that the intelligence exists, the deck falls out of it — with speaker notes, and no invented numbers.",
                            action: "Generate deck",
                            icon: <Presentation className="mr-2 h-4 w-4" />,
                            kind: "PITCH_DECK",
                        }}
                        generate={generate}
                        isBusy={isBusy}
                    />
                </TabsContent>

                <TabsContent value="investors" className="mt-6">
                    <InvestorViews startupId={id} />
                </TabsContent>

                <TabsContent value="profile" className="mt-6 space-y-6">
                    <DeckUpload startupId={id} onFilled={() => load(false)} />
                    <SipSummary
                        sip={startup.sip_data}
                        editHref={`/dashboard/startups/${id}/edit`}
                    />
                </TabsContent>

                <TabsContent value="history" className="mt-6 space-y-2">
                    {reports.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nothing generated yet.</p>
                    )}
                    {reports.map((r) => (
                        <Card key={r.id}>
                            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <Badge
                                        variant={
                                            r.status === "COMPLETED"
                                                ? "high"
                                                : r.status === "FAILED"
                                                    ? "low"
                                                    : "outline"
                                        }
                                    >
                                        {r.status}
                                    </Badge>
                                    <span className="text-sm font-medium">
                                        {r.type.replace(/_/g, " ").toLowerCase()}
                                    </span>
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {new Date(r.created_at).toLocaleString()}
                                    </span>
                                </div>
                                {typeof r.score_summary?.total_score === "number" && (
                                    <span
                                        className={cn(
                                            "font-mono text-lg tabular",
                                            r.score_summary.total_score >= 70
                                                ? "text-score-high"
                                                : r.score_summary.total_score >= 45
                                                    ? "text-score-mid"
                                                    : "text-score-low",
                                        )}
                                    >
                                        {r.score_summary.total_score}
                                        <span className="text-muted-foreground/40">/100</span>
                                    </span>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                    <StartupSettings startup={startup} onSaved={setStartup} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function GenerateButton({
    kind,
    icon,
    label,
    busyLabel,
    generate,
    isBusy,
    variant,
}: {
    kind: ReportType
    icon: React.ReactNode
    label: string
    busyLabel?: string
    generate: (kind: ReportType) => void
    isBusy: (kind: ReportType) => boolean
    variant?: "default" | "outline"
}) {
    const busy = isBusy(kind)
    return (
        <Button variant={variant} onClick={() => generate(kind)} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
            {busy ? busyLabel ?? "Generating" : label}
        </Button>
    )
}

/** A generated artefact, or the invitation to generate it. */
function ReportPane({
    report,
    render,
    empty,
    generate,
    isBusy,
}: {
    report: Report | null
    render: (report: Report) => React.ReactNode
    empty: {
        eyebrow: string
        title: string
        body: string
        action: string
        icon: React.ReactNode
        kind: ReportType
    }
    generate: (kind: ReportType) => void
    isBusy: (kind: ReportType) => boolean
}) {
    if (report) {
        return (
            <div className="space-y-4">
                {render(report)}
                {report.status !== "PENDING" && (
                    <div className="flex justify-end">
                        <GenerateButton
                            kind={empty.kind}
                            icon={empty.icon}
                            label="Regenerate"
                            generate={generate}
                            isBusy={isBusy}
                            variant="outline"
                        />
                    </div>
                )}
            </div>
        )
    }

    return (
        <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.18]" />
            <CardContent className="relative flex flex-col items-start gap-5 p-10">
                <div className="max-w-md space-y-2">
                    <span className="eyebrow">{empty.eyebrow}</span>
                    <h2 className="text-lg font-semibold tracking-tight">{empty.title}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{empty.body}</p>
                </div>
                <GenerateButton
                    kind={empty.kind}
                    icon={empty.icon}
                    label={empty.action}
                    generate={generate}
                    isBusy={isBusy}
                />
            </CardContent>
        </Card>
    )
}

function DetailSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-4 w-24" />
            <div className="flex items-start justify-between gap-6">
                <div className="space-y-3">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-9 w-56" />
            </div>
            <Skeleton className="h-10 w-full max-w-2xl" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}
