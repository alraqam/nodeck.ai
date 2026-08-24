import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

/** Split layout: a quiet brand panel carrying the positioning, and the form.
 *  The panel collapses away below `lg` so the form is never pushed below the
 *  fold on a laptop. */
export function AuthShell({
    eyebrow,
    title,
    subtitle,
    children,
    footer,
}: {
    eyebrow: string
    title: string
    subtitle: string
    children: React.ReactNode
    footer: React.ReactNode
}) {
    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            <aside className="relative hidden flex-col justify-between overflow-hidden border-r bg-card/40 p-10 lg:flex">
                <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.15]" />

                <Link href="/" className="relative flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-primary" />
                    <span className="text-sm font-semibold tracking-tight">NoDeck</span>
                </Link>

                <div className="relative max-w-sm space-y-5">
                    <p className="text-2xl font-semibold leading-snug tracking-tight text-balance">
                        &ldquo;You do not care about clean slides. You care about whether the
                        market is real.&rdquo;
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Every profile is scored against the same four things a general
                        partner actually looks for: market, moat, team, and the non-obvious
                        insight.
                    </p>
                </div>

                <p className="relative font-mono text-xs tracking-wide text-muted-foreground/70">
                    30 average &middot; 70 Series A ready &middot; 90 generational
                </p>
            </aside>

            <main className="relative flex flex-col">
                <div className="flex h-14 items-center justify-end px-6">
                    <ThemeToggle className="text-muted-foreground" />
                </div>

                <div className="flex flex-1 items-center justify-center px-6 pb-16">
                    <div className="w-full max-w-sm">
                        <span className="eyebrow">{eyebrow}</span>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

                        <div className="mt-8">{children}</div>

                        <div className="mt-6 text-center text-sm text-muted-foreground">
                            {footer}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return <p className="text-xs text-destructive">{message}</p>
}
