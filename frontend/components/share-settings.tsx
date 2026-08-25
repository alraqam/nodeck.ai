"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import { copyToClipboard } from "@/lib/export"
import type { ShareSettings as Settings } from "@/lib/types"
import { toast } from "sonner"
import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, X } from "lucide-react"

export function ShareSettings({ startupId }: { startupId: string }) {
    const [settings, setSettings] = useState<Settings | null>(null)
    const [busy, setBusy] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        api.getShare(startupId)
            .then(setSettings)
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) return
                setSettings({ enabled: false, include_score: false })
            })
    }, [startupId])

    // Built in the browser so the link matches whatever host the founder is
    // actually on, rather than a value baked in at build time.
    const url =
        settings?.share_token && typeof window !== "undefined"
            ? `${window.location.origin}/s/${settings.share_token}`
            : null

    async function run(action: () => Promise<Settings>, message: string) {
        setBusy(true)
        try {
            setSettings(await action())
            toast.success(message)
        } catch (e) {
            toast.error("Could not update sharing", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setBusy(false)
        }
    }

    if (!settings) {
        return (
            <Card>
                <CardContent className="space-y-3 p-5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full max-w-md" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardContent className="space-y-5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="eyebrow">Public link</span>
                        <Badge variant={settings.enabled ? "high" : "outline"}>
                            {settings.enabled ? "Live" : "Off"}
                        </Badge>
                    </div>
                    {settings.enabled ? (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => run(() => api.disableShare(startupId), "Link revoked")}
                        >
                            <X className="mr-2 h-3 w-3" /> Revoke
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => run(() => api.enableShare(startupId), "Link created")}
                        >
                            {busy ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                                <Link2 className="mr-2 h-3 w-3" />
                            )}
                            Create link
                        </Button>
                    )}
                </div>

                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                    A read-only page an investor can open without an account. It shows your
                    Intelligence Profile — never your red flags, memo or investor views.
                    Those stay in your account.
                </p>

                {settings.enabled && url && (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
                                {url}
                            </code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    if (await copyToClipboard(url)) {
                                        setCopied(true)
                                        toast.success("Link copied")
                                        setTimeout(() => setCopied(false), 2000)
                                    } else {
                                        toast.error("Could not reach the clipboard")
                                    }
                                }}
                            >
                                {copied ? (
                                    <Check className="mr-2 h-3 w-3 text-score-high" />
                                ) : (
                                    <Copy className="mr-2 h-3 w-3" />
                                )}
                                Copy
                            </Button>
                            <a href={url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                    <ExternalLink className="mr-2 h-3 w-3" /> Open
                                </Button>
                            </a>
                        </div>

                        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                            <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                                checked={settings.include_score}
                                disabled={busy}
                                onChange={(e) =>
                                    run(
                                        () =>
                                            api.updateShare(startupId, {
                                                include_score: e.target.checked,
                                            }),
                                        e.target.checked
                                            ? "Score is now visible on the link"
                                            : "Score hidden from the link",
                                    )
                                }
                            />
                            <span className="space-y-1">
                                <span className="block text-sm font-medium">
                                    Include the fundability score
                                </span>
                                <span className="block text-xs leading-relaxed text-muted-foreground">
                                    Adds the score, breakdown, summary and green flags. Red flags
                                    are never shared, whatever this is set to.
                                </span>
                            </span>
                        </label>

                        <div className="flex items-center justify-between gap-3 border-t pt-4">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Sent it to the wrong person? Rotating mints a new link and breaks
                                the old one immediately.
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                className="shrink-0 text-muted-foreground"
                                onClick={() =>
                                    run(() => api.enableShare(startupId), "New link created")
                                }
                            >
                                <RefreshCw className="mr-2 h-3 w-3" /> Rotate
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
