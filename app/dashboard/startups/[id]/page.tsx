"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReportViewer } from "@/components/report-viewer"
import { api, ApiError } from "@/lib/api"
import type { Report, Startup } from "@/lib/types"
import { toast } from "sonner"
import { Loader2, Pencil, Sparkles } from "lucide-react"

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
                const newest = r[0]
                if (newest?.status === "PENDING") setPollingId(newest.id)
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
            toast.info("Analysis started", { description: "This usually takes under two minutes." })
            setPollingId(report_id)
        } catch (e) {
            toast.error("Could not start analysis", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setTriggering(false)
        }
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
        )
    }
    if (!startup) return <p className="text-sm text-destructive">Profile not found.</p>

    const latest = reports[0]
    const busy = triggering || pollingId !== null

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{startup.name}</h1>
                    <p className="text-muted-foreground">{startup.one_liner}</p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/dashboard/startups/${id}/edit`}>
                        <Button variant="outline">
                            <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                        </Button>
                    </Link>
                    <Button onClick={analyze} disabled={busy}>
                        {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {pollingId ? "Analysing..." : "Analyze Fundability"}
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="intelligence">Intelligence Profile</TabsTrigger>
                    <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-4">
                    {latest ? (
                        <ReportViewer report={latest} />
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Fundability Score</CardTitle>
                                <CardDescription>
                                    A general partner reads your profile and scores it out of 100.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed p-8 text-center text-muted-foreground">
                                    <p>No analysis yet.</p>
                                    <Button variant="outline" onClick={analyze} disabled={busy}>
                                        Run Analysis
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="intelligence" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Intelligence Profile</CardTitle>
                            <CardDescription>
                                <Link href={`/dashboard/startups/${id}/edit`} className="underline">
                                    Edit this profile
                                </Link>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <pre className="max-h-[500px] overflow-auto rounded-md bg-muted p-4 text-xs">
                                {JSON.stringify(startup.sip_data ?? {}, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="reports" className="mt-6 space-y-4">
                    {reports.length === 0 && (
                        <p className="text-sm text-muted-foreground">No reports yet.</p>
                    )}
                    {reports.map((r) => (
                        <Card key={r.id}>
                            <CardHeader>
                                <CardTitle className="text-base">{r.type}</CardTitle>
                                <CardDescription>
                                    {r.status} &middot; {new Date(r.created_at).toLocaleString()}
                                </CardDescription>
                            </CardHeader>
                            {r.status === "COMPLETED" && (
                                <CardContent className="text-sm text-muted-foreground">
                                    Score {r.content?.total_score} / 100
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    )
}
