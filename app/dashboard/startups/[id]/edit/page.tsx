"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { SipForm } from "@/components/sip-form"
import { api, ApiError } from "@/lib/api"
import type { SIP, Startup } from "@/lib/types"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"

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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
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
                <h1 className="text-3xl font-bold tracking-tight">Intelligence Profile</h1>
                <p className="text-muted-foreground">
                    This replaces your deck. Every section feeds the analysis, and gaps are
                    scored as gaps.
                </p>
            </div>

            <SipForm initial={startup.sip_data} onSave={save} />
        </div>
    )
}
