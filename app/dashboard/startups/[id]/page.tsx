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
import { SipSummary } from "@/components/sip-summary"
import { api, ApiError } from "@/lib/api"
import type { Report, Startup } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Pencil, Sparkles } from "lucide-react"

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 60 // ~3 minutes

export default function StartupDetailPage() {
    const id = String(useParams().id)

    const [startup, setStartup] = useState<Startup | null>(null)
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [pollingId, setPollingId] = useState<string | null>(null)
    const [triggering, setTriggering] = useState(false)

    useEffect(() => {
        Promise.all([api.getStartup(id), api.listReports(id)])
            .then(([s, r]) => {
                setStartup(s)
                setReports(r)
                // Resume polling if an analysis was still running when the page
                // was last closed - this survives a refresh mid-analysis.
                if (r[0]?.status === "PENDING") setPollingId(r[0].id)
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) return
                toast.error(e instanceof ApiError ? e.message : "Could not load this profile")
            })
            .finally(() => setLoading(false))
    }, [id])

    useEffect(() => {
        if (!pollingId) return

        let cancelled = false
        let attempts = 0

        const upsert = (report: Report) =>
            setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)])

        const tick = async () => {
            if (cancelled) return
            try {
                const report = await api.getReport(pollingId)
                if (cancelled) return
                if (report.status === "COMPLETED") {
                    upsert(report)
                    setPollingId(null)
                    toast.success("Analysis complete")
                    return
                }
                if (report.status === "FAILED") {
                    upsert(report)
                    setPollingId(null)
                    toast.error("Analysis failed", {
                        description: report.content?.error ?? "Please try again.",
                    })
                    return
                }
            } catch {
                // Transient failure - keep polling until the attempt cap.
            }
            attempts += 1
            if (attempts >= MAX_POLL_ATTEMPTS) {
                setPollingId(null)
                toast.warning("Still running", { description: "Refresh in a minute." })
                return
            }
            // Recursive setTimeout, not setInterval: a slow response must not
            // let requests stack up on top of each other.
            timer = setTimeout(tick, POLL_INTERVAL_MS)
        }

        let timer = setTimeout(tick, 1500)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [pollingId])

    const analyze = useCallback(async () => {
        setTriggering(true)
        try {
            const { report_id } = await api.analyze(id)
            toast.info("Analysis started", {
                description: "This usually takes under two minutes.",
            })
            setPollingId(report_id)
        } catch (e) {
            toast.error("Could not start analysis", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setTriggering(false)
        }
    }, [id])

    if (loading) return <DetailSkeleton />
    if (!startup) return <p className="text-sm text-destructive">Profile not found.</p>

    const latest = reports[0]
    const busy = triggering || pollingId !== null
    const shown: Report | null = pollingId
        ? ({ ...(latest ?? {}), id: pollingId, status: "PENDING" } as Report)
        : latest ?? null

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
                    <h1 className="truncate text-3xl font-semibold tracking-tight">
                        {startup.name}
                    </h1>
                    {startup.one_liner && (
                        <p className="mt-1.5 max-w-2xl text-pretty text-muted-foreground">
                            {startup.one_liner}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/dashboard/startups/${id}/edit`}>
                        <Button variant="outline">
                            <Pencil className="mr-2 h-4 w-4" /> Edit profile
                        </Button>
                    </Link>
                    <Button onClick={analyze} disabled={busy}>
                        {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {pollingId ? "Analysing" : "Analyze fundability"}
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="score">
                <TabsList>
                    <TabsTrigger value="score">Score</TabsTrigger>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="history">
                        History
                        {reports.length > 0 && (
                            <span className="ml-1.5 font-mono text-[0.6875rem] text-muted-foreground">
                                {reports.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="score" className="mt-6">
                    {shown ? (
                        <ReportViewer report={shown} />
                    ) : (
                        <Card className="relative overflow-hidden">
                            <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.18]" />
                            <CardContent className="relative flex flex-col items-start gap-5 p-10">
                                <div className="max-w-md space-y-2">
                                    <span className="eyebrow">Not scored yet</span>
                                    <h2 className="text-lg font-semibold tracking-tight">
                                        Find out where you actually stand
                                    </h2>
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        A general partner reads the profile and scores it out of
                                        100 — market, moat, team, insight — then names every red
                                        flag they see.
                                    </p>
                                </div>
                                <Button onClick={analyze} disabled={busy}>
                                    <Sparkles className="mr-2 h-4 w-4" /> Run analysis
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="profile" className="mt-6">
                    <SipSummary
                        sip={startup.sip_data}
                        editHref={`/dashboard/startups/${id}/edit`}
                    />
                </TabsContent>

                <TabsContent value="history" className="mt-6 space-y-2">
                    {reports.length === 0 && (
                        <p className="text-sm text-muted-foreground">No analyses run yet.</p>
                    )}
                    {reports.map((r) => (
                        <Card key={r.id}>
                            <CardContent className="flex items-center justify-between gap-4 p-4">
                                <div className="flex items-center gap-3">
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
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {new Date(r.created_at).toLocaleString()}
                                    </span>
                                </div>
                                {r.status === "COMPLETED" && (
                                    <span
                                        className={cn(
                                            "font-mono text-lg tabular",
                                            (r.content?.total_score ?? 0) >= 70
                                                ? "text-score-high"
                                                : (r.content?.total_score ?? 0) >= 45
                                                    ? "text-score-mid"
                                                    : "text-score-low",
                                        )}
                                    >
                                        {r.content?.total_score}
                                        <span className="text-muted-foreground/40">/100</span>
                                    </span>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
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
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}
