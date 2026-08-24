"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SIP } from "@/lib/types"
import { Pencil } from "lucide-react"

/** Compact USD formatting - $9.4B reads instantly where 9400000000 does not. */
function money(n?: number | null) {
    if (n === null || n === undefined) return null
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: n >= 1_000_000 ? "compact" : "standard",
        maximumFractionDigits: 1,
    }).format(n)
}

const num = (n?: number | null) =>
    n === null || n === undefined ? null : new Intl.NumberFormat("en-US").format(n)

export function SipSummary({ sip, editHref }: { sip?: Partial<SIP> | null; editHref: string }) {
    const s = sip ?? {}
    const filled = (
        ["identity", "problem", "solution", "market", "traction", "fundraising"] as const
    ).filter((k) => {
        const v = s[k]
        return v && Object.values(v).some((x) => x !== null && x !== "" && !(Array.isArray(x) && !x.length))
    }).length
    const hasTeam = (s.team ?? []).length > 0
    const sections = filled + (hasTeam ? 1 : 0)

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="eyebrow">Intelligence Profile</span>
                    <Badge variant={sections === 7 ? "high" : "outline"}>
                        {sections}/7 sections
                    </Badge>
                </div>
                <Link href={editHref}>
                    <Button variant="outline" size="sm">
                        <Pencil className="mr-2 h-3 w-3" /> Edit
                    </Button>
                </Link>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
                <Block title="Problem">
                    <Prose>{s.problem?.description}</Prose>
                    <Chips items={s.problem?.pain_points} />
                    {s.problem?.validated && <Badge variant="high">Customer validated</Badge>}
                </Block>

                <Block title="Solution">
                    {s.solution?.product_name && (
                        <p className="text-sm font-medium">{s.solution.product_name}</p>
                    )}
                    <Prose>{s.solution?.description}</Prose>
                    {s.solution?.moat && (
                        <div className="space-y-1 border-l-2 border-primary/40 pl-3">
                            <span className="eyebrow">Moat</span>
                            <Prose>{s.solution.moat}</Prose>
                        </div>
                    )}
                    <Chips items={s.solution?.tech_stack} />
                </Block>

                <Block title="Market">
                    <Stats
                        rows={[
                            ["TAM", money(s.market?.tam)],
                            ["SAM", money(s.market?.sam)],
                            ["SOM", money(s.market?.som)],
                            [
                                "Growth",
                                s.market?.market_growth_rate != null
                                    ? `${s.market.market_growth_rate}%`
                                    : null,
                            ],
                        ]}
                    />
                    <Prose>{s.market?.target_customer_persona}</Prose>
                </Block>

                <Block title="Traction">
                    <Stats
                        rows={Object.entries(s.traction?.metrics ?? {}).map(([k, v]) => [
                            k.replace(/_/g, " "),
                            num(v),
                        ])}
                    />
                    <Bullets items={s.traction?.milestones} />
                    <Chips items={s.traction?.customer_logos} />
                </Block>

                <Block title="Team">
                    {(s.team ?? []).length === 0 ? (
                        <Empty />
                    ) : (
                        <ul className="space-y-3">
                            {s.team!.map((m, i) => (
                                <li key={i} className="space-y-0.5">
                                    <p className="text-sm">
                                        <span className="font-medium">{m.name}</span>
                                        {m.role && (
                                            <span className="text-muted-foreground"> — {m.role}</span>
                                        )}
                                    </p>
                                    {m.superpower && (
                                        <p className="text-xs text-primary">{m.superpower}</p>
                                    )}
                                    {m.bio && (
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            {m.bio}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Block>

                <Block title="The ask">
                    <Stats
                        rows={[
                            ["Stage", s.fundraising?.round_stage ?? null],
                            ["Raising", money(s.fundraising?.ask_amount)],
                            ["Cap", money(s.fundraising?.valuation_cap)],
                        ]}
                    />
                    <Prose>{s.fundraising?.use_of_funds}</Prose>
                </Block>
            </div>
        </div>
    )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
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

function Empty() {
    return <p className="text-sm text-muted-foreground/60">Not filled in yet.</p>
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
                    <span className="text-primary">&middot;</span>
                    {x}
                </li>
            ))}
        </ul>
    )
}

function Stats({ rows }: { rows: [string, string | null][] }) {
    const shown = rows.filter(([, v]) => v)
    if (!shown.length) return <Empty />
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
