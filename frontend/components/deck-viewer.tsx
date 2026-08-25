"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PitchDeck, Report, Slide } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MessageSquareText, TriangleAlert } from "lucide-react"

export function DeckViewer({ report }: { report: Report }) {
    const [showNotes, setShowNotes] = useState(false)

    if (report.status === "PENDING") return <DeckSkeleton />

    if (report.status === "FAILED") {
        return (
            <Card className="border-destructive/30">
                <CardContent className="flex items-start gap-3 p-5">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Deck generation failed</p>
                        <p className="text-sm text-muted-foreground">
                            {report.content?.error ?? "Something went wrong. Run it again."}
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const deck = report.content as Partial<PitchDeck> | null | undefined
    const slides = deck?.slides ?? []

    if (!slides.length) {
        return (
            <Card>
                <CardContent className="p-5 text-sm text-muted-foreground">
                    This deck has no readable content.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <span className="eyebrow">Generated deck</span>
                    <h2 className="mt-1.5 truncate text-xl font-semibold tracking-tight">
                        {deck?.title}
                    </h2>
                    {deck?.subtitle && (
                        <p className="mt-1 text-sm text-muted-foreground">{deck.subtitle}</p>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNotes((v) => !v)}
                    aria-pressed={showNotes}
                >
                    <MessageSquareText className="mr-2 h-3 w-3" />
                    {showNotes ? "Hide speaker notes" : "Speaker notes"}
                </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
                {slides.map((slide, i) => (
                    <SlideCard key={i} index={i} slide={slide} showNotes={showNotes} />
                ))}
            </div>
        </div>
    )
}

function SlideCard({
    index,
    slide,
    showNotes,
}: {
    index: number
    slide: Slide
    showNotes: boolean
}) {
    return (
        <Card className="flex flex-col overflow-hidden">
            {/* 16:9 so the card reads as a slide rather than a list item. */}
            <CardContent className="flex aspect-[16/9] flex-col p-6">
                <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-lg font-semibold leading-tight tracking-tight text-balance">
                    {slide.title}
                </h3>
                <ul className="mt-4 space-y-2 overflow-y-auto">
                    {slide.bullets.map((bullet, b) => (
                        <li key={b} className="flex gap-2.5 text-sm leading-relaxed">
                            <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-primary" />
                            <span className="text-muted-foreground">{bullet}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>

            {slide.speaker_notes && (
                <div
                    className={cn(
                        "border-t bg-muted/40 px-6 py-4",
                        showNotes ? "block" : "hidden",
                    )}
                >
                    <span className="eyebrow">Say this</span>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {slide.speaker_notes}
                    </p>
                </div>
            )}
        </Card>
    )
}

function DeckSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="grid gap-3 lg:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardContent className="flex aspect-[16/9] flex-col gap-3 p-6">
                            <Skeleton className="h-3 w-6" />
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="mt-2 h-3 w-full" />
                            <Skeleton className="h-3 w-5/6" />
                            <Skeleton className="h-3 w-4/6" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
