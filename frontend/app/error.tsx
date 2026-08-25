"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { RotateCw, TriangleAlert } from "lucide-react"

/**
 * What a user sees when a render throws.
 *
 * Without this, React unmounts the tree and Next shows a blank page: no
 * explanation, no way back, and nothing to report. A founder half-way through
 * a profile would have no idea whether their work still existed.
 *
 * The error is deliberately not printed. `error.message` on a client boundary
 * can carry an internal path or a fragment of a response, and this screen is
 * the one place a stranger is most likely to be looking at it.
 */
export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // The console is the only place the detail belongs.
        console.error("Unhandled render error:", error)
    }, [error])

    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex h-14 items-center border-b px-6">
                <Logo />
            </header>

            <main className="flex flex-1 items-center justify-center px-6">
                <div className="w-full max-w-md space-y-5 py-16">
                    <TriangleAlert className="h-6 w-6 text-score-mid" />
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Something broke on this page
                        </h1>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            The rest of the app still works, and nothing you had already saved
                            is affected. Unsaved edits to an Intelligence Profile are kept in
                            this browser and offered back when you reopen it.
                        </p>
                    </div>

                    {error.digest && (
                        // Correlates with the server log without exposing anything.
                        <p className="font-mono text-xs text-muted-foreground">
                            Reference: {error.digest}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button onClick={reset}>
                            <RotateCw className="mr-2 h-4 w-4" /> Try again
                        </Button>
                        <Link href="/dashboard">
                            <Button variant="outline">Back to your profiles</Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}
