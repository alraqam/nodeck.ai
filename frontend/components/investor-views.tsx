"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import type { InvestorView, InvestorViewContent } from "@/lib/types"
import { toast } from "sonner"
import { ChevronDown, Loader2, Plus, Target } from "lucide-react"

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 60

export function InvestorViews({ startupId }: { startupId: string }) {
    const [views, setViews] = useState<InvestorView[] | null>(null)
    const [creating, setCreating] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [name, setName] = useState("")
    const [thesis, setThesis] = useState("")

    // Every PENDING view currently being polled, so a refresh mid-generation
    // resumes rather than leaving a row stuck on "Generating".
    const polling = useRef<Set<string>>(new Set())

    const upsert = useCallback((view: InvestorView) => {
        setViews((prev) => [view, ...(prev ?? []).filter((v) => v.id !== view.id)])
    }, [])

    const poll = useCallback(
        (viewId: string) => {
            if (polling.current.has(viewId)) return
            polling.current.add(viewId)

            let attempts = 0
            const tick = async () => {
                try {
                    const view = await api.getInvestorView(viewId)
                    if (view.status !== "PENDING") {
                        upsert(view)
                        polling.current.delete(viewId)
                        if (view.status === "FAILED") {
                            toast.error(`${view.investor_name} view failed`, {
                                description: view.content?.error ?? "Please try again.",
                            })
                        } else {
                            toast.success(`${view.investor_name} view ready`)
                        }
                        return
                    }
                } catch {
                    // Transient failure - keep polling to the attempt cap.
                }
                attempts += 1
                if (attempts >= MAX_POLL_ATTEMPTS) {
                    polling.current.delete(viewId)
                    return
                }
                // Recursive setTimeout, not setInterval: a slow response must not
                // let requests stack up on each other.
                setTimeout(tick, POLL_INTERVAL_MS)
            }
            setTimeout(tick, 1500)
        },
        [upsert],
    )

    useEffect(() => {
        api.listInvestorViews(startupId)
            .then((list) => {
                setViews(list)
                list.filter((v) => v.status === "PENDING").forEach((v) => poll(v.id))
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) return
                setViews([])
            })
    }, [startupId, poll])

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (!name.trim()) return

        setSubmitting(true)
        try {
            const { view_id } = await api.createInvestorView(startupId, {
                investor_name: name.trim(),
                investor_thesis: thesis.trim() || undefined,
            })
            // Show the row immediately rather than waiting a poll cycle.
            upsert({
                id: view_id,
                startup_id: startupId,
                investor_name: name.trim(),
                investor_thesis: thesis.trim() || null,
                status: "PENDING",
                content: null,
                created_at: new Date().toISOString(),
            })
            setName("")
            setThesis("")
            setCreating(false)
            poll(view_id)
        } catch (e) {
            toast.error("Could not create that view", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <span className="eyebrow">Investor views</span>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        The same facts, retold for one investor&apos;s thesis.
                    </p>
                </div>
                {!creating && (
                    <Button size="sm" onClick={() => setCreating(true)}>
                        <Plus className="mr-2 h-3 w-3" /> New view
                    </Button>
                )}
            </div>

            {creating && (
                <Card>
                    <CardContent className="p-5">
                        <form onSubmit={submit} className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="investor_name">Investor</Label>
                                <Input
                                    id="investor_name"
                                    autoFocus
                                    placeholder="Sequoia Capital"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="investor_thesis">Their thesis</Label>
                                <Textarea
                                    id="investor_thesis"
                                    rows={3}
                                    placeholder="Climate infrastructure, deep tech, European seed."
                                    value={thesis}
                                    onChange={(e) => setThesis(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    The more specific the thesis, the sharper the reframing.
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setCreating(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={submitting || !name.trim()}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Generate view
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {views === null && (
                <div className="grid gap-3">
                    {[0, 1].map((i) => (
                        <Card key={i}>
                            <CardContent className="space-y-2 p-5">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {views?.length === 0 && !creating && (
                <Card className="relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.18]" />
                    <CardContent className="relative flex flex-col items-start gap-4 p-8">
                        <Target className="h-5 w-5 text-primary" />
                        <div className="max-w-md space-y-1.5">
                            <h3 className="font-semibold tracking-tight">No investor views yet</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Name an investor and their thesis, and the profile gets retold to
                                lead with what they actually underwrite. Facts never change — only
                                emphasis.
                            </p>
                        </div>
                        <Button onClick={() => setCreating(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Create one
                        </Button>
                    </CardContent>
                </Card>
            )}

            {views?.map((view) => (
                <ViewCard key={view.id} view={view} />
            ))}
        </div>
    )
}

function ViewCard({ view }: { view: InvestorView }) {
    const [open, setOpen] = useState(false)
    // Keep `error` on the type: a FAILED view stores { error } in the same
    // column a COMPLETED one uses for its content.
    const content = view.content as
        | (Partial<InvestorViewContent> & { error?: string })
        | null
        | undefined
    const done = view.status === "COMPLETED"

    return (
        <Card>
            <CardContent className="p-0">
                <button
                    type="button"
                    onClick={() => done && setOpen((v) => !v)}
                    disabled={!done}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left disabled:cursor-default"
                >
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold tracking-tight">{view.investor_name}</h3>
                            <Badge
                                variant={
                                    view.status === "COMPLETED"
                                        ? "high"
                                        : view.status === "FAILED"
                                            ? "low"
                                            : "outline"
                                }
                            >
                                {view.status === "PENDING" ? "Generating" : view.status}
                            </Badge>
                        </div>
                        {view.investor_thesis && (
                            <p className="truncate text-sm text-muted-foreground">
                                {view.investor_thesis}
                            </p>
                        )}
                        {view.status === "FAILED" && (
                            <p className="text-sm text-destructive">
                                {content?.error ?? "Generation failed."}
                            </p>
                        )}
                    </div>
                    {view.status === "PENDING" ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : done ? (
                        <ChevronDown
                            className={cnChevron(open)}
                            aria-hidden
                        />
                    ) : null}
                </button>

                {open && done && content && (
                    <div className="space-y-6 border-t p-5">
                        {content.angle && (
                            <div className="space-y-1.5 border-l-2 border-primary/40 pl-4">
                                <span className="eyebrow">The angle</span>
                                <p className="text-sm leading-relaxed">{content.angle}</p>
                            </div>
                        )}

                        {content.sections?.map((section, i) => (
                            <div key={i} className="space-y-1.5">
                                <span className="eyebrow">{section.title}</span>
                                <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                                    {section.content}
                                </p>
                            </div>
                        ))}

                        {!!content.metrics_to_lead_with?.length && (
                            <div className="space-y-2">
                                <span className="eyebrow">Lead with these numbers</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {content.metrics_to_lead_with.map((m, i) => (
                                        <Badge key={i} variant="primary">
                                            {m}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!!content.talking_points?.length && (
                            <div className="space-y-2">
                                <span className="eyebrow">Talking points</span>
                                <ul className="space-y-2">
                                    {content.talking_points.map((point, i) => (
                                        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                                            <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-primary" />
                                            <span className="text-muted-foreground">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

const cnChevron = (open: boolean) =>
    `h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`
