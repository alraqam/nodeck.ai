"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, ApiError } from "@/lib/api"
import type { Stage, Startup } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"

const STAGES: { value: Stage; label: string }[] = [
    { value: "PRE_SEED", label: "Pre-seed" },
    { value: "SEED", label: "Seed" },
    { value: "SERIES_A", label: "Series A" },
]

export function StartupSettings({
    startup,
    onSaved,
}: {
    startup: Startup
    onSaved: (updated: Startup) => void
}) {
    const router = useRouter()
    const [name, setName] = useState(startup.name ?? "")
    const [oneLiner, setOneLiner] = useState(startup.one_liner ?? "")
    const [stage, setStage] = useState<Stage | null>((startup.stage as Stage) ?? null)
    const [industry, setIndustry] = useState((startup.industry ?? []).join(", "))
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)

    async function save(event: React.FormEvent) {
        event.preventDefault()
        setSaving(true)
        try {
            const updated = await api.updateStartup(startup.id, {
                name: name.trim(),
                one_liner: oneLiner.trim(),
                stage,
                industry: industry
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
            })
            onSaved(updated)
            toast.success("Saved")
        } catch (e) {
            toast.error("Could not save", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setSaving(false)
        }
    }

    async function remove() {
        setDeleting(true)
        try {
            await api.deleteStartup(startup.id)
            toast.success("Profile deleted")
            router.replace("/dashboard")
        } catch (e) {
            toast.error("Could not delete", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
            setDeleting(false)
        }
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-5">
                    <form onSubmit={save} className="grid gap-4">
                        <span className="eyebrow">Basics</span>

                        <div className="grid gap-2">
                            <Label htmlFor="s_name">Name</Label>
                            <Input
                                id="s_name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="s_one_liner">One-liner</Label>
                            <Input
                                id="s_one_liner"
                                value={oneLiner}
                                onChange={(e) => setOneLiner(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Stage</Label>
                            {/* Segmented control rather than a select: three fixed options
                                are faster to hit than a dropdown, and clicking the active
                                one clears it. */}
                            <div className="flex flex-wrap gap-1.5">
                                {STAGES.map((s) => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setStage(stage === s.value ? null : s.value)}
                                        className={cn(
                                            "rounded-md border px-3 py-1.5 text-sm transition-colors",
                                            stage === s.value
                                                ? "border-primary/40 bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="s_industry">Industry</Label>
                            <Input
                                id="s_industry"
                                placeholder="Energy, Climate"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Comma separated.</p>
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={saving || !name.trim()}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-destructive/30">
                <CardContent className="space-y-4 p-5">
                    <span className="eyebrow">Danger zone</span>
                    <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                        Deleting this profile also deletes every score, memo, deck and investor
                        view generated from it. This cannot be undone.
                    </p>

                    {confirmingDelete ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                                Delete {startup.name} permanently?
                            </span>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={remove}
                                disabled={deleting}
                            >
                                {deleting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                Yes, delete
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmingDelete(false)}
                                disabled={deleting}
                            >
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
                            <Trash2 className="mr-2 h-3 w-3" /> Delete profile
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
