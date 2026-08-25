"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CohortImport } from "@/components/cohort-import"
import { CohortRanking } from "@/components/cohort-ranking"
import { api, ApiError, getToken } from "@/lib/api"
import type { CohortReport } from "@/lib/types"
import { toast } from "sonner"
import { ArrowLeft, Download, Loader2, Trash2 } from "lucide-react"

// Scoring is queued, so the page polls while anything is still running. Same
// approach as lib/use-reports.ts: recursive setTimeout, never setInterval, so a
// slow response cannot let requests stack up.
const POLL_INTERVAL_MS = 4000

export default function CohortDetailPage() {
    const id = String(useParams().id)
    const router = useRouter()

    const [report, setReport] = useState<CohortReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const polling = useRef(false)

    const load = useCallback(
        async (showError = true) => {
            try {
                const next = await api.getCohortReport(id)
                setReport(next)
                return next
            } catch (e) {
                if (e instanceof ApiError && e.status === 401) return null
                if (showError) {
                    toast.error(e instanceof ApiError ? e.message : "Could not load this cohort")
                }
                return null
            }
        },
        [id],
    )

    useEffect(() => {
        load().finally(() => setLoading(false))
    }, [load])

    // Keep refreshing while the worker still has jobs for this cohort.
    useEffect(() => {
        const pending = report?.rows.some((r) => r.status === "PENDING")
        if (!pending || polling.current) return
        polling.current = true

        let cancelled = false
        const tick = async () => {
            if (cancelled) return
            const next = await load(false)
            if (cancelled) return
            if (next?.rows.some((r) => r.status === "PENDING")) {
                timer = setTimeout(tick, POLL_INTERVAL_MS)
            } else {
                polling.current = false
                toast.success("Scoring finished")
            }
        }
        let timer = setTimeout(tick, POLL_INTERVAL_MS)
        return () => {
            cancelled = true
            polling.current = false
            clearTimeout(timer)
        }
    }, [report, load])

    async function remove() {
        setDeleting(true)
        try {
            await api.deleteCohort(id)
            toast.success("Cohort deleted")
            router.replace("/dashboard/cohorts")
        } catch (e) {
            toast.error("Could not delete", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
            setDeleting(false)
        }
    }

    function downloadCsv() {
        // The export is a file download, not JSON, so it cannot go through the
        // usual client. Fetch with the token, then hand the blob to the browser.
        fetch(`/api${api.cohortExportPath(id)}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error(String(res.status))
                return res.blob()
            })
            .then((blob) => {
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = `${report?.cohort.name ?? "cohort"}-outcomes.csv`
                document.body.appendChild(link)
                link.click()
                link.remove()
                setTimeout(() => URL.revokeObjectURL(url), 0)
                toast.success("Exported")
            })
            .catch(() => toast.error("Could not export"))
    }

    if (loading) return <CohortSkeleton />
    if (!report) return <p className="text-sm text-destructive">Cohort not found.</p>

    const { cohort, rows, distribution } = report
    const pending = rows.filter((r) => r.status === "PENDING").length

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/cohorts"
                className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> All cohorts
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-0 flex-1 basis-72">
                    <h1 className="truncate text-3xl font-semibold tracking-tight">
                        {cohort.name}
                    </h1>
                    {cohort.description && (
                        <p className="mt-1.5 max-w-2xl text-pretty text-muted-foreground">
                            {cohort.description}
                        </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge
                            variant={
                                cohort.startup_count > 0 && cohort.scored_count === cohort.startup_count
                                    ? "high"
                                    : "outline"
                            }
                        >
                            {cohort.scored_count}/{cohort.startup_count} scored
                        </Badge>
                        {pending > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {pending} still running
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <Button
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        onClick={downloadCsv}
                        disabled={!rows.length}
                    >
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="ranking">
                <TabsList>
                    <TabsTrigger value="ranking">
                        Ranking
                        {rows.length > 0 && (
                            <span className="ml-1.5 font-mono text-[0.6875rem] text-muted-foreground">
                                {rows.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="import">Import decks</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="ranking" className="mt-6">
                    <CohortRanking
                        rows={rows}
                        distribution={distribution}
                        onOutcomeSaved={() => load(false)}
                    />
                </TabsContent>

                <TabsContent value="import" className="mt-6">
                    <CohortImport cohortId={id} onImported={() => load(false)} />
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                    <Card className="border-destructive/30">
                        <CardContent className="space-y-4 p-5">
                            <span className="eyebrow">Danger zone</span>
                            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                Deleting this cohort also deletes every startup imported into it,
                                their scores, and any outcomes recorded against them. This cannot
                                be undone.
                            </p>
                            {confirmingDelete ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">
                                        Delete {cohort.name} and {cohort.startup_count} startup(s)?
                                    </span>
                                    <Button variant="destructive" size="sm" onClick={remove} disabled={deleting}>
                                        {deleting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                        Yes, delete
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setConfirmingDelete(true)}
                                >
                                    <Trash2 className="mr-2 h-3 w-3" /> Delete cohort
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

function CohortSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}
