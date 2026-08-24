import { cn } from "@/lib/utils"

/**
 * The brand mark: three stacked cards (the deck) with a three-node graph
 * resting on top - "no deck, a graph instead".
 *
 * Geometry is copied verbatim from nodeck-icon.svg in the five-project brand
 * kit; do not redraw it by eye. The cards are painted with `currentColor` so
 * the mark inverts with the theme exactly the way the kit's light/dark pair
 * does (ink #15161A on paper, paper #FAFAF9 on ink). The amber node graph is
 * fixed in both themes - it is the one constant in the identity.
 */
export function LogoMark({ className }: { className?: string }) {
    return (
        <svg
            viewBox="30 54 196 156"
            className={cn("h-[1.35rem] w-[1.7rem] shrink-0 text-foreground", className)}
            role="img"
            aria-label="Nodeck AI"
        >
            <rect x="58" y="104" width="150" height="98" rx="14" fill="currentColor" fillOpacity="0.28" />
            <rect x="48" y="86" width="164" height="104" rx="15" fill="currentColor" fillOpacity="0.55" />
            <rect x="38" y="62" width="180" height="112" rx="16" fill="currentColor" />
            <line x1="80" y1="140" x2="128" y2="94" stroke="#F5A524" strokeWidth="5" strokeOpacity="0.6" />
            <line x1="128" y1="94" x2="176" y2="136" stroke="#F5A524" strokeWidth="5" strokeOpacity="0.6" />
            <line x1="80" y1="140" x2="176" y2="136" stroke="#F5A524" strokeWidth="5" strokeOpacity="0.35" />
            <circle cx="128" cy="94" r="13" fill="#F5A524" />
            <circle cx="80" cy="140" r="10" fill="#F5A524" />
            <circle cx="176" cy="136" r="10" fill="#F5A524" />
        </svg>
    )
}

/**
 * Mark plus wordmark. All-caps with positive tracking and ` AI` in brand
 * amber, matching nodeck-logo.svg rather than being restyled.
 */
export function Logo({
    className,
    markClassName,
    showTagline = false,
}: {
    className?: string
    markClassName?: string
    showTagline?: boolean
}) {
    return (
        <span className={cn("flex items-center gap-2.5", className)}>
            <LogoMark className={markClassName} />
            <span className="flex flex-col leading-none">
                <span className="text-sm font-bold tracking-[0.02em]">
                    NODECK<span className="text-brand"> AI</span>
                </span>
                {showTagline && (
                    <span className="mt-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Startup Deal-Flow Intelligence
                    </span>
                )}
            </span>
        </span>
    )
}
