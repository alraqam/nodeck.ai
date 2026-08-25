"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import type { Cohort } from "@/lib/types"
import { toast } from "sonner"
import { ArrowRight, Layers, Loader2, Plus } from "lucide-react"

export default function CohortsPage() {
    const [cohorts, setCohorts] = useState<Cohort[] | null>(null)
    const [creating, setCreating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    // A founder account reaching this page gets 403, not a crash.
    const [forbidden, setForbidden] = useState(false)

    useEffect(() => {
        api.listCohorts()
            .then(setCohorts)
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) return
                if (e instanceof ApiError && e.status === 403) {
                    setForbidden(true)
                    setCohorts([])
                    return
                }
                toast.error("Could not load cohorts")
                setCohorts([])
            })
    }, [])

    async function create(event: React.FormEvent) {
        event.preventDefault()
        setSaving(true)
        try {
            const cohort = await api.createCohort({
                name: name.trim(),
                description: description.trim() || undefined,
            })
            setCohorts((prev) => [cohort, ...(prev ?? [])])
            setName("")
            setDescription("")
            setCreating(false)
            toast.success("Cohort created")
        } catch (e) {
            toast.error("Could not create cohort", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setSaving(false)
        }
    }

    if (forbidden) {
        return (
            <Card>
                <CardContent className="space-y-2 p-8">
                    <h1 className="text-lg font-semibold tracking-tight">
                        Cohort screening is for accelerator accounts
                    </h1>
                    <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                        This is where an accelerator scores a whole intake at once. Your
                        account screens its own profiles instead.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <span className="eyebrow">Screening</span>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">Cohorts</h1>
                </div>
                {!creating && (
                    <Button onClick={() => setCreating(true)}>
                        <Plus className="mr-2 h-4 w-4" /> New cohort
                    </Button>
                )}
            </div>

            {creating && (
                <Card>
                    <CardContent className="p-5">
                        <form onSubmit={create} className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="cohort_name">Name</Label>
                                <Input
                                    id="cohort_name"
                                    autoFocus
                                    placeholder="IT Park Autumn 2026"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cohort_desc">Description</Label>
                                <Input
                                    id="cohort_desc"
                                    placeholder="Optional"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving || !name.trim()}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {cohorts === null && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1].map((i) => (
                        <Card key={i}>
                            <CardContent className="space-y-3 p-5">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-24" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {cohorts?.length === 0 && !creating && (
                <Card className="relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.18]" />
                    <CardContent className="relative flex flex-col items-start gap-5 p-10">
                        <Layers className="h-5 w-5 text-primary" />
                        <div className="max-w-md space-y-2">
                            <h2 className="text-lg font-semibold tracking-tight">No cohorts yet</h2>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Create one, drop in the intake&apos;s decks, and every startup is
                                scored on the same rubric — then ranked in one report.
                            </p>
                        </div>
                        <Button onClick={() => setCreating(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Create your first cohort
                        </Button>
                    </CardContent>
                </Card>
            )}

            {cohorts && cohorts.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {cohorts.map((c) => (
                        <Link key={c.id} href={`/dashboard/cohorts/${c.id}`} className="group">
                            <Card className="h-full transition-colors group-hover:border-primary/50">
                                <CardContent className="flex h-full flex-col gap-2 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="min-w-0 truncate font-semibold tracking-tight">
                                            {c.name}
                                        </h3>
                                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                                    </div>
                                    {c.description && (
                                        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                            {c.description}
                                        </p>
                                    )}
                                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                                        <Badge
                                            variant={
                                                c.startup_count > 0 && c.scored_count === c.startup_count
                                                    ? "high"
                                                    : "outline"
                                            }
                                        >
                                            {c.scored_count}/{c.startup_count} scored
                                        </Badge>
                                        <span className="ml-auto font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                                            {new Date(c.created_at).toLocaleDateString(undefined, {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
