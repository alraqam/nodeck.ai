"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { SipForm } from "@/components/sip-form"
import { api, ApiError } from "@/lib/api"
import type { SIP, Startup } from "@/lib/types"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"

export default function EditSipPage() {
    // useParams types params as string | string[].
    const id = String(useParams().id)
    const router = useRouter()

    const [startup, setStartup] = useState<Startup | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        api.getStartup(id)
            .then(setStartup)
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) return
                setError(e instanceof ApiError ? e.message : "Could not load this profile")
            })
    }, [id])

    const save = async (payload: Partial<SIP>) => {
        try {
            await api.updateSip(id, payload)
            toast.success("Intelligence Profile saved")
            router.push(`/dashboard/startups/${id}`)
        } catch (e) {
            toast.error("Could not save", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        }
    }

    if (error) return <p className="text-sm text-destructive">{error}</p>
    if (!startup) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-10 w-full max-w-2xl" />
                <Skeleton className="h-80 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href={`/dashboard/startups/${id}`}
                    className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-3 w-3" /> Back to {startup.name}
                </Link>
                <span className="eyebrow">Intelligence Profile</span>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                    {startup.name}
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                    This replaces your deck. Every section feeds the analysis, and a gap is
                    scored as a gap - not skipped.
                </p>
            </div>

            <SipForm initial={startup.sip_data} onSave={save} />
        </div>
    )
}
