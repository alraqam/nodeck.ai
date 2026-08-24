"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api"
import type { StartupSummary } from "@/lib/types"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
                    <p className="text-muted-foreground">Your startup intelligence profiles.</p>
                </div>
                <Link href="/dashboard/startups/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Profile
                    </Button>
                </Link>
            </div>

            {startups === null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
            )}

            {startups?.length === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>No profiles yet</CardTitle>
                        <CardDescription>
                            A profile replaces your deck. Create one, fill in the Intelligence
                            Profile, then run a fundability analysis.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/startups/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create your first profile
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            {startups && startups.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {startups.map((s) => (
                        <Link key={s.id} href={`/dashboard/startups/${s.id}`}>
                            <Card className="h-full transition-colors hover:border-primary">
                                <CardHeader>
                                    <CardTitle>{s.name}</CardTitle>
                                    <CardDescription>
                                        {s.one_liner || "No one-liner yet"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground">
                                    Created {new Date(s.created_at).toLocaleDateString()}
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
