"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { api } from "@/lib/api"
import type { PublicProfile, ScoreBreakdown } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The shared, unauthenticated profile.
 *
 * Deliberately outside /dashboard so it never mounts AuthGuard or the sidebar:
 * a visitor has no account, and anything that redirected to /login would break
 * the one flow this page exists for.
 */

const CRITERIA: [keyof ScoreBreakdown, string][] = [
    ["market_opportunity", "Market"],
    ["product_solution", "Product"],
    ["traction_execution", "Traction"],
    ["team", "Team"],
    ["moat_risks", "Moat"],
]

const money = (n?: number | null) =>
    n === null || n === undefined
        ? null
        : new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              notation: n >= 1_000_000 ? "compact" : "standard",
              maximumFractionDigits: 1,
          }).format(n)

const tone = (n: number) =>
    n >= 70 ? "text-score-high" : n >= 45 ? "text-score-mid" : "text-score-low"

export default function SharedProfilePage() {
    const token = String(useParams().token)
    const [profile, setProfile] = useState<PublicProfile | null>(null)
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        api.getPublicProfile(token)
            .then(setProfile)
            // A revoked link, a typo and a link that never existed all land
            // here identically - the server does not distinguish them either.
            .catch(() => setNotFound(true))
    }, [token])

    if (notFound) {
        return (
            <Shell>
                <div className="mx-auto max-w-md py-24 text-center">
                    <h1 className="text-xl font-semibold tracking-tight">
                        This link is not available
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        It may have been revoked by its owner, or it may never have existed.
                        Ask whoever sent it for a new one.
                    </p>
                </div>
            </Shell>
        )
    }

    if (!profile) {
        return (
            <Shell>
                <div className="space-y-6 py-12">
                    <Skeleton className="h-10 w-72" />
                    <Skeleton className="h-4 w-96" />
                    <div className="grid gap-3 lg:grid-cols-2">
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-40 w-full" />
                        ))}
                    </div>
                </div>
            </Shell>
        )
    }

    const { score } = profile

    return (
        <Shell>
            <article className="space-y-8 py-12">
                <header className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-4xl font-semibold tracking-tight">{profile.name}</h1>
                        {profile.stage && (
                            <Badge variant="outline">{profile.stage.replace(/_/g, " ")}</Badge>
                        )}
                    </div>
                    {profile.one_liner && (
                        <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
                            {profile.one_liner}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {profile.industry.map((tag) => (
                            <Badge key={tag}>{tag}</Badge>
                        ))}
                        {profile.identity.website && (
                            <a
                                href={profile.identity.website}
                                target="_blank"
                                // noreferrer as well as noopener: the destination has no
                                // business learning the share token from the referrer.
                                rel="noopener noreferrer nofollow"
                                className="ml-1 text-sm text-primary underline underline-offset-4"
                            >
                                {profile.identity.website.replace(/^https?:\/\//, "")}
                            </a>
                        )}
                        {profile.identity.location && (
                            <span className="text-sm text-muted-foreground">
                                · {profile.identity.location}
                            </span>
                        )}
                    </div>
                </header>

                {score && typeof score.total_score === "number" && (
                    <Card className="relative overflow-hidden">
                        <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.18]" />
                        <CardContent className="relative grid gap-8 p-6 lg:grid-cols-[minmax(0,16rem)_1fr] lg:gap-12">
                            <div>
                                <span className="eyebrow">Fundability</span>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span
                                        className={cn(
                                            "font-mono text-6xl font-semibold leading-none tabular tracking-tighter",
                                            tone(score.total_score),
                                        )}
                                    >
                                        {score.total_score}
                                    </span>
                                    <span className="font-mono text-xl text-muted-foreground/50">
                                        /100
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {score.breakdown && (
                                    <div className="grid gap-2.5 sm:grid-cols-2">
                                        {CRITERIA.map(([key, label]) => (
                                            <div key={key} className="flex items-baseline justify-between gap-3 border-b pb-1.5">
                                                <span className="text-sm text-muted-foreground">{label}</span>
                                                <span className="font-mono text-sm tabular">
                                                    {score.breakdown![key]}
                                                    <span className="text-muted-foreground/40">/10</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {score.summary && (
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        {score.summary}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                    <Section title="Problem">
                        <Prose>{profile.problem.description}</Prose>
                        <Chips items={profile.problem.pain_points} />
                        {profile.problem.validated && <Badge variant="high">Customer validated</Badge>}
                    </Section>

                    <Section title="Solution">
                        {profile.solution.product_name && (
                            <p className="text-sm font-medium">{profile.solution.product_name}</p>
                        )}
                        <Prose>{profile.solution.description}</Prose>
                        {profile.solution.moat && (
                            <div className="space-y-1 border-l-2 border-primary/40 pl-3">
                                <span className="eyebrow">Moat</span>
                                <Prose>{profile.solution.moat}</Prose>
                            </div>
                        )}
                        <Chips items={profile.solution.tech_stack} />
                    </Section>

                    <Section title="Market">
                        <Stats
                            rows={[
                                ["TAM", money(profile.market.tam)],
                                ["SAM", money(profile.market.sam)],
                                ["SOM", money(profile.market.som)],
                                [
                                    "Growth",
                                    profile.market.market_growth_rate != null
                                        ? `${profile.market.market_growth_rate}%`
                                        : null,
                                ],
                            ]}
                        />
                        <Prose>{profile.market.target_customer_persona}</Prose>
                    </Section>

                    <Section title="Traction">
                        <Stats
                            rows={Object.entries(profile.traction.metrics ?? {}).map(([k, v]) => [
                                k.replace(/_/g, " "),
                                new Intl.NumberFormat("en-US").format(Number(v)),
                            ])}
                        />
                        <Bullets items={profile.traction.milestones} />
                        <Chips items={profile.traction.customer_logos} />
                    </Section>

                    {profile.team.length > 0 && (
                        <Section title="Team">
                            <ul className="space-y-3">
                                {profile.team.map((m, i) => (
                                    <li key={i} className="space-y-0.5">
                                        <p className="text-sm">
                                            <span className="font-medium">{m.name}</span>
                                            {m.role && <span className="text-muted-foreground"> — {m.role}</span>}
                                        </p>
                                        {m.superpower && <p className="text-xs text-primary">{m.superpower}</p>}
                                        {m.bio && (
                                            <p className="text-xs leading-relaxed text-muted-foreground">{m.bio}</p>
                                        )}
                                        {m.linkedin && (
                                            <a
                                                href={m.linkedin}
                                                target="_blank"
                                                rel="noopener noreferrer nofollow"
                                                className="text-xs text-primary underline underline-offset-4"
                                            >
                                                LinkedIn
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    <Section title="The ask">
                        <Stats
                            rows={[
                                ["Stage", profile.fundraising.round_stage ?? null],
                                ["Raising", money(profile.fundraising.ask_amount)],
                            ]}
                        />
                        <Prose>{profile.fundraising.use_of_funds}</Prose>
                    </Section>
                </div>
            </article>
        </Shell>
    )
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen">
            <header className="flex h-14 items-center justify-between border-b px-6">
                <Logo />
                <div className="flex items-center gap-3">
                    <span className="hidden font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
                        Shared profile
                    </span>
                    <ThemeToggle className="text-muted-foreground" />
                </div>
            </header>
            <main className="mx-auto max-w-5xl px-6">{children}</main>
            <footer className="mx-auto max-w-5xl border-t px-6 py-8">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    Shared with NoDeck. This page shows only what its owner chose to publish.
                </p>
            </footer>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card>
            <CardContent className="space-y-3 p-5">
                <span className="eyebrow">{title}</span>
                {children}
            </CardContent>
        </Card>
    )
}

function Prose({ children }: { children?: string | null }) {
    if (!children) return null
    return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
}

function Chips({ items }: { items?: string[] | null }) {
    if (!items?.length) return null
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((x, i) => (
                <Badge key={i} variant="outline">
                    {x}
                </Badge>
            ))}
        </div>
    )
}

function Bullets({ items }: { items?: string[] | null }) {
    if (!items?.length) return null
    return (
        <ul className="space-y-1.5">
            {items.map((x, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-primary">·</span>
                    {x}
                </li>
            ))}
        </ul>
    )
}

function Stats({ rows }: { rows: [string, string | null][] }) {
    const shown = rows.filter(([, v]) => v)
    if (!shown.length) return null
    return (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {shown.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 border-b pb-1.5">
                    <dt className="truncate text-xs capitalize text-muted-foreground">{label}</dt>
                    <dd className="shrink-0 font-mono text-sm tabular">{value}</dd>
                </div>
            ))}
        </dl>
    )
}
