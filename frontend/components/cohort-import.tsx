"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api, ApiError } from "@/lib/api"
import type { DeckImportResponse } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { FileUp, Loader2 } from "lucide-react"

// Mirrors MAX_FILES_PER_REQUEST and MAX_DECK_BYTES on the server, so an
// oversized batch fails here rather than after the upload.
const MAX_FILES = 40
const MAX_BYTES_EACH = 20 * 1024 * 1024

export function CohortImport({
    cohortId,
    onImported,
}: {
    cohortId: string
    onImported: () => void
}) {
    const [busy, setBusy] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [result, setResult] = useState<DeckImportResponse | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    async function upload(fileList: FileList | File[]) {
        const files = [...fileList].filter((f) => /\.pdf$/i.test(f.name))
        if (!files.length) {
            toast.error("No PDFs in that selection")
            return
        }
        if (files.length > MAX_FILES) {
            toast.error(`Upload at most ${MAX_FILES} decks at a time`)
            return
        }
        const oversized = files.filter((f) => f.size > MAX_BYTES_EACH)
        if (oversized.length) {
            toast.error(`${oversized.length} file(s) are over 20MB`, {
                description: oversized.map((f) => f.name).join(", ").slice(0, 120),
            })
            return
        }

        setBusy(true)
        setResult(null)
        try {
            const res = await api.importDecks(cohortId, files)
            setResult(res)
            if (res.imported) {
                toast.success(`Imported ${res.imported} deck(s)`, {
                    description: "Scoring runs in the background.",
                })
                onImported()
            }
            if (res.failed) {
                toast.warning(`${res.failed} deck(s) could not be read`)
            }
        } catch (e) {
            toast.error("Import failed", {
                description: e instanceof ApiError ? e.message : "Please try again.",
            })
        } finally {
            setBusy(false)
            // Clear so re-picking the same files fires onChange again.
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
                    if (e.dataTransfer.files?.length) upload(e.dataTransfer.files)
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
                            {busy ? "Reading the intake…" : "Drop the whole intake here"}
                        </p>
                        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                            Up to {MAX_FILES} PDFs at once. Each is read and queued for
                            scoring; one unreadable deck will not stop the rest.
                        </p>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files?.length && upload(e.target.files)}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => inputRef.current?.click()}
                    >
                        Choose PDFs
                    </Button>
                </CardContent>
            </Card>

            {result && (
                <Card>
                    <CardContent className="space-y-3 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="eyebrow">Import result</span>
                            <Badge variant={result.imported ? "high" : "outline"}>
                                {result.imported} imported
                            </Badge>
                            {result.failed > 0 && (
                                <Badge variant="low">{result.failed} failed</Badge>
                            )}
                        </div>
                        {/* Every file reported by name. A silent gap in the ranking is
                            worse than a named failure. */}
                        <ul className="space-y-1.5">
                            {result.results.map((r) => (
                                <li
                                    key={r.filename}
                                    className="flex flex-wrap items-baseline gap-x-2 text-sm"
                                >
                                    <span
                                        className={cn(
                                            "font-mono text-xs",
                                            r.ok ? "text-score-high" : "text-score-low",
                                        )}
                                    >
                                        {r.ok ? "ok" : "fail"}
                                    </span>
                                    <span className="truncate">{r.filename}</span>
                                    <span className="text-muted-foreground">
                                        {r.ok
                                            ? `→ ${r.startup_name}${
                                                  r.fields_filled.length
                                                      ? ` · ${r.fields_filled.length} fields`
                                                      : " · nothing extracted"
                                              }`
                                            : r.error}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
