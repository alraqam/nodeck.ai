"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    copyToClipboard,
    downloadMarkdown,
    filenameFor,
    reportToMarkdown,
} from "@/lib/export"
import type { Report } from "@/lib/types"
import { toast } from "sonner"
import { Check, Copy, Download, Printer } from "lucide-react"

/**
 * Export controls for one finished artefact.
 *
 * Three routes on purpose, because each goes somewhere different: copy for
 * pasting into an email or Notion, download for keeping and editing, print for
 * the PDF an investor expects as an attachment.
 */
export function ExportMenu({
    report,
    startupName,
}: {
    report: Report
    startupName: string
}) {
    const [copied, setCopied] = useState(false)

    const markdown = reportToMarkdown(report, startupName)
    if (!markdown) return null

    async function copy() {
        const ok = await copyToClipboard(markdown!)
        if (!ok) {
            toast.error("Could not reach the clipboard", {
                description: "Use Download instead.",
            })
            return
        }
        setCopied(true)
        toast.success("Copied as Markdown")
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
                {copied ? (
                    <Check className="mr-2 h-3 w-3 text-score-high" />
                ) : (
                    <Copy className="mr-2 h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy"}
            </Button>

            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                    downloadMarkdown(filenameFor(report, startupName), markdown!)
                    toast.success("Downloaded")
                }}
            >
                <Download className="mr-2 h-3 w-3" /> Markdown
            </Button>

            {/* The browser's own print dialog rather than a PDF library: it
                honours the print stylesheet, adds no dependency, and lets the
                user pick page size and margins. */}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-3 w-3" /> PDF
            </Button>
        </div>
    )
}
