import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] transition-colors",
    {
        variants: {
            variant: {
                default: "border-transparent bg-secondary text-secondary-foreground",
                outline: "text-muted-foreground",
                primary: "border-primary/25 bg-primary/10 text-primary",
                low: "border-score-low/25 bg-score-low/10 text-score-low",
                mid: "border-score-mid/25 bg-score-mid/10 text-score-mid",
                high: "border-score-high/25 bg-score-high/10 text-score-high",
            },
        },
        defaultVariants: { variant: "default" },
    },
)

export function Badge({
    className,
    variant,
    ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
