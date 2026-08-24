"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { api, ApiError } from "@/lib/api"
import type { StartupSummary } from "@/lib/types"
import { toast } from "sonner"
import { ArrowRight, Plus } from "lucide-react"

/** Same thresholds the report hero uses, so a card and its report never
 *  disagree about whether a score is good. */
const scoreTone = (score: number) =>
    score >= 70 ? "text-score-high" : score >= 45 ? "text-score-mid" : "text-score-low"

export default function DashboardPage() {
    const [startups, setStartups] = useState<StartupSummary[] | null>(null)

    useEffect(() => {
        api.listStartups()
            .then(setStartups)
            .catch((error) => {
                // A 401 already redirects to /login inside the api client.
                if (error instanceof ApiError && error.status === 401) return
                toast.error("Could not load your profiles")
                setStartups([])
            })
    }, [])

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <span className="eyebrow">Overview</span>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                        Intelligence profiles
                    </h1>
                </div>
                <Link href="/dashboard/startups/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New profile
                    </Button>
                </Link>
            </div>

            {startups === null && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <Card key={i}>
                            <CardContent className="space-y-3 p-5">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-20" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {startups?.length === 0 && (
                <Card className="relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.18]" />
                    <CardContent className="relative flex flex-col items-start gap-5 p-10">
                        <div className="max-w-md space-y-2">
                            <h2 className="text-lg font-semibold tracking-tight">
                                No profiles yet
                            </h2>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                A profile replaces your deck. Create one, fill in the
                                Intelligence Profile, then have a general partner score it out
                                of 100.
                            </p>
                        </div>
                        <Link href="/dashboard/startups/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create your first profile
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            {startups && startups.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {startups.map((s) => (
                        <Link key={s.id} href={`/dashboard/startups/${s.id}`} className="group">
                            <Card className="h-full transition-colors group-hover:border-primary/50">
                                <CardContent className="flex h-full flex-col gap-2 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="min-w-0 truncate font-semibold tracking-tight">
                                            {s.name}
                                        </h3>
                                        {typeof s.latest_score === "number" ? (
                                            <span
                                                className={cn(
                                                    "shrink-0 font-mono text-2xl leading-none tabular",
                                                    scoreTone(s.latest_score),
                                                )}
                                            >
                                                {s.latest_score}
                                            </span>
                                        ) : (
                                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                                        )}
                                    </div>
                                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                        {s.one_liner || "No one-liner yet"}
                                    </p>
                                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                                        {s.stage && (
                                            <Badge variant="outline">{s.stage.replace(/_/g, " ")}</Badge>
                                        )}
                                        {s.industry?.slice(0, 2).map((tag) => (
                                            <Badge key={tag}>{tag}</Badge>
                                        ))}
                                        <span className="ml-auto font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground/60">
                                            {new Date(s.created_at).toLocaleDateString(undefined, {
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
