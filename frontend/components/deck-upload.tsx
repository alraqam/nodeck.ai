"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api, ApiError } from "@/lib/api"
import type { DeckUploadResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { FileUp, Loader2 } from "lucide-react"

// Mirrors MAX_DECK_BYTES on the server. Checked here too so a 20MB upload
// fails instantly instead of after the round trip.
const MAX_BYTES = 20 * 1024 * 1024

export function DeckUpload({
    startupId,
    onFilled,
}: {
    startupId: string
    /** Fired after a successful parse so the parent can refetch the profile. */
    onFilled: () => void
}) {
    const [busy, setBusy] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [result, setResult] = useState<DeckUploadResult | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    async function upload(file: File) {
        if (file.size > MAX_BYTES) {
            toast.error("That file is too large", { description: "The limit is 20MB." })
            return
        }
        setBusy(true)
        setResult(null)
        try {
            const res = await api.uploadDeck(startupId, file)
            setResult(res)
            if (res.fields_filled.length) {
                toast.success(`Filled ${res.fields_filled.length} field(s) from your deck`)
                onFilled()
            } else {
                toast.info("Nothing new to fill", {
                    description: "Everything the deck covers is already in your profile.",
                })
            }
        } catch (e) {
            toast.error("Could not read that deck", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setBusy(false)
            // Clear the input so re-picking the same file fires onChange again.
            if (inputRef.current) inputRef.current.value = ""
        }
    }

    return (
        <div className="space-y-3">
            <Card
                onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file) upload(file)
                }}
                className={cn(
                    "border-dashed transition-colors",
                    dragging && "border-primary bg-primary/5",
                )}
            >
                <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                    {busy ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                        <FileUp className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="space-y-1">
                        <p className="text-sm font-medium">
                            {busy ? "Reading your deck…" : "Already have a deck? Drop the PDF here"}
                        </p>
                        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                            It fills only the blanks. Anything you have already written stays
                            exactly as you wrote it.
                        </p>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) upload(file)
                        }}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => inputRef.current?.click()}
                    >
                        Choose a PDF
                    </Button>
                </CardContent>
            </Card>

            {result && (
                <Card>
                    <CardContent className="space-y-3 p-5">
                        <span className="eyebrow">
                            {result.fields_filled.length
                                ? `Filled ${result.fields_filled.length} field(s)`
                                : "Nothing to fill"}
                        </span>
                        {!!result.fields_filled.length && (
                            <div className="flex flex-wrap gap-1.5">
                                {result.fields_filled.map((f) => (
                                    <Badge key={f} variant="high">
                                        {f}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {result.notes && (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {result.notes}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
