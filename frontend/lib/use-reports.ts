"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api, ApiError } from "@/lib/api"
import type { Report, ReportType } from "@/lib/types"
import { toast } from "sonner"

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 60 // ~3 minutes

const TRIGGER = {
    FUNDABILITY_SCORE: api.analyze,
    INVESTMENT_MEMO: api.generateMemo,
    PITCH_DECK: api.generateDeck,
} as const

const LABEL = {
    FUNDABILITY_SCORE: "Analysis",
    INVESTMENT_MEMO: "Memo",
    PITCH_DECK: "Deck",
} as const

/**
 * Owns every report for one startup: the list, which types are mid-generation,
 * and the polling that resolves them.
 *
 * All three report types share this because they differ only in the endpoint
 * hit and the noun in the toast. Keeping one implementation means a fix to the
 * polling logic cannot land for scores and be forgotten for decks.
 */
export function useReports(startupId: string) {
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [pending, setPending] = useState<Partial<Record<ReportType, string>>>({})

    // Ids already being polled, so a re-render never starts a second loop for
    // the same report.
    const polling = useRef<Set<string>>(new Set())

    const upsert = useCallback((report: Report) => {
        setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)])
    }, [])

    const poll = useCallback(
        (reportId: string, kind: ReportType) => {
            if (polling.current.has(reportId)) return
            polling.current.add(reportId)

            let attempts = 0
            const finish = () => {
                polling.current.delete(reportId)
                setPending((p) => {
                    const next = { ...p }
                    delete next[kind]
                    return next
                })
            }

            const tick = async () => {
                try {
                    const report = await api.getReport(reportId)
                    if (report.status !== "PENDING") {
                        upsert(report)
                        finish()
                        if (report.status === "FAILED") {
                            toast.error(`${LABEL[kind]} failed`, {
                                description: report.content?.error ?? "Please try again.",
                            })
                        } else {
                            toast.success(`${LABEL[kind]} ready`)
                        }
                        return
                    }
                } catch {
                    // Transient failure - keep polling until the attempt cap.
                }
                attempts += 1
                if (attempts >= MAX_POLL_ATTEMPTS) {
                    finish()
                    toast.warning(`${LABEL[kind]} is still running`, {
                        description: "Refresh in a minute.",
                    })
                    return
                }
                // Recursive setTimeout, not setInterval: a slow response must not
                // let requests stack up on top of each other.
                setTimeout(tick, POLL_INTERVAL_MS)
            }
            setTimeout(tick, 1500)
        },
        [upsert],
    )

    useEffect(() => {
        let cancelled = false
        api.listReports(startupId)
            .then((list) => {
                if (cancelled) return
                setReports(list)
                // Resume anything left PENDING by a refresh mid-generation.
                const resumed: Partial<Record<ReportType, string>> = {}
                for (const r of list) {
                    if (r.status !== "PENDING") continue
                    const kind = r.type as ReportType
                    if (resumed[kind]) continue
                    resumed[kind] = r.id
                    poll(r.id, kind)
                }
                setPending(resumed)
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) return
                toast.error("Could not load reports")
            })
            .finally(() => !cancelled && setLoading(false))
        return () => {
            cancelled = true
        }
    }, [startupId, poll])

    const generate = useCallback(
        async (kind: ReportType) => {
            try {
                const { report_id } = await TRIGGER[kind](startupId)
                setPending((p) => ({ ...p, [kind]: report_id }))
                toast.info(`${LABEL[kind]} started`, {
                    description: "This usually takes under two minutes.",
                })
                poll(report_id, kind)
            } catch (e) {
                toast.error(`Could not start the ${LABEL[kind].toLowerCase()}`, {
                    description: e instanceof ApiError ? e.message : "Please try again.",
                })
            }
        },
        [startupId, poll],
    )

    /** Newest report of a type, or a synthetic PENDING one while generating. */
    const latest = useCallback(
        (kind: ReportType): Report | null => {
            const pendingId = pending[kind]
            if (pendingId) {
                return {
                    id: pendingId,
                    startup_id: startupId,
                    type: kind,
                    status: "PENDING",
                    content: null,
                    created_at: new Date().toISOString(),
                }
            }
            return reports.find((r) => r.type === kind) ?? null
        },
        [reports, pending, startupId],
    )

    return {
        reports,
        loading,
        generate,
        latest,
        isBusy: (kind: ReportType) => Boolean(pending[kind]),
    }
}
