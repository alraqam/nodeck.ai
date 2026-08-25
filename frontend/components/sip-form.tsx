"use client"

import { cloneElement, isValidElement, useId, useState } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SIP } from "@/lib/types"
import { useFormDraft, useUnsavedChangesWarning } from "@/lib/use-form-draft"
import { History, Loader2, Plus, Trash2, X } from "lucide-react"

/**
 * Numbers arrive from HTML inputs as strings, so every numeric field is
 * coerced. Everything is optional and nullish-tolerant: the SIP is a draft a
 * founder fills in over several sittings, and a half-finished section must not
 * block saving the rest.
 */
const optionalNumber = z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
        if (v === undefined || v === null || v === "") return null
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    })

const sipSchema = z.object({
    identity: z.object({
        website: z.string().optional(),
        location: z.string().optional(),
        founded_year: optionalNumber,
        contact_email: z.string().optional(),
    }),
    problem: z.object({
        description: z.string().optional(),
        pain_points_str: z.string().optional(),
        current_solutions: z.string().optional(),
        validated: z.boolean().optional(),
    }),
    solution: z.object({
        product_name: z.string().optional(),
        description: z.string().optional(),
        value_proposition: z.string().optional(),
        tech_stack_str: z.string().optional(),
        moat: z.string().optional(),
    }),
    market: z.object({
        tam: optionalNumber,
        sam: optionalNumber,
        som: optionalNumber,
        market_growth_rate: optionalNumber,
        target_customer_persona: z.string().optional(),
    }),
    traction: z.object({
        metrics: z.array(z.object({ key: z.string(), value: z.union([z.string(), z.number()]) })),
        milestones_str: z.string().optional(),
        customer_logos_str: z.string().optional(),
    }),
    team: z.array(
        z.object({
            name: z.string().optional(),
            role: z.string().optional(),
            linkedin: z.string().optional(),
            bio: z.string().optional(),
            superpower: z.string().optional(),
        }),
    ),
    fundraising: z.object({
        round_stage: z.string().optional(),
        ask_amount: optionalNumber,
        valuation_cap: optionalNumber,
        use_of_funds: z.string().optional(),
    }),
})

type SipForm = z.input<typeof sipSchema>
type SipParsed = z.output<typeof sipSchema>

const splitList = (s?: string) =>
    (s ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)

const joinList = (xs?: string[] | null) => (xs ?? []).join(", ")

/** Build form defaults from whatever the server has, filling every field so no
 *  input is ever uncontrolled. */
function toDefaults(sip?: Partial<SIP> | null): SipForm {
    const s = sip ?? {}
    return {
        identity: {
            website: s.identity?.website ?? "",
            location: s.identity?.location ?? "",
            founded_year: s.identity?.founded_year ?? "",
            contact_email: s.identity?.contact_email ?? "",
        },
        problem: {
            description: s.problem?.description ?? "",
            pain_points_str: joinList(s.problem?.pain_points),
            current_solutions: s.problem?.current_solutions ?? "",
            validated: s.problem?.validated ?? false,
        },
        solution: {
            product_name: s.solution?.product_name ?? "",
            description: s.solution?.description ?? "",
            value_proposition: s.solution?.value_proposition ?? "",
            tech_stack_str: joinList(s.solution?.tech_stack),
            moat: s.solution?.moat ?? "",
        },
        market: {
            tam: s.market?.tam ?? "",
            sam: s.market?.sam ?? "",
            som: s.market?.som ?? "",
            market_growth_rate: s.market?.market_growth_rate ?? "",
            target_customer_persona: s.market?.target_customer_persona ?? "",
        },
        traction: {
            metrics: Object.entries(s.traction?.metrics ?? {}).map(([key, value]) => ({
                key,
                value,
            })),
            milestones_str: joinList(s.traction?.milestones),
            customer_logos_str: joinList(s.traction?.customer_logos),
        },
        team: (s.team ?? []).map((m) => ({
            name: m.name ?? "",
            role: m.role ?? "",
            linkedin: m.linkedin ?? "",
            bio: m.bio ?? "",
            superpower: m.superpower ?? "",
        })),
        fundraising: {
            round_stage: s.fundraising?.round_stage ?? "",
            ask_amount: s.fundraising?.ask_amount ?? "",
            valuation_cap: s.fundraising?.valuation_cap ?? "",
            use_of_funds: s.fundraising?.use_of_funds ?? "",
        },
    }
}

/** Form shape -> the SIP shape the API expects. */
function toPayload(d: SipParsed): Partial<SIP> {
    const metrics: Record<string, number> = {}
    for (const { key, value } of d.traction.metrics) {
        const name = String(key ?? "").trim()
        if (!name) continue
        const n = Number(value)
        if (Number.isFinite(n)) metrics[name] = n
    }

    return {
        identity: {
            website: d.identity.website || null,
            location: d.identity.location || null,
            founded_year: d.identity.founded_year,
            contact_email: d.identity.contact_email || null,
        },
        problem: {
            description: d.problem.description || null,
            pain_points: splitList(d.problem.pain_points_str),
            current_solutions: d.problem.current_solutions || null,
            validated: Boolean(d.problem.validated),
        },
        solution: {
            product_name: d.solution.product_name || null,
            description: d.solution.description || null,
            value_proposition: d.solution.value_proposition || null,
            tech_stack: splitList(d.solution.tech_stack_str),
            moat: d.solution.moat || null,
        },
        market: {
            tam: d.market.tam,
            sam: d.market.sam,
            som: d.market.som,
            market_growth_rate: d.market.market_growth_rate,
            target_customer_persona: d.market.target_customer_persona || null,
        },
        traction: {
            metrics,
            milestones: splitList(d.traction.milestones_str),
            customer_logos: splitList(d.traction.customer_logos_str),
        },
        team: d.team
            .filter((m) => (m.name || m.role || m.bio || m.superpower || m.linkedin))
            .map((m) => ({
                name: m.name || null,
                role: m.role || null,
                linkedin: m.linkedin || null,
                bio: m.bio || null,
                superpower: m.superpower || null,
            })),
        fundraising: {
            round_stage: d.fundraising.round_stage || null,
            ask_amount: d.fundraising.ask_amount,
            valuation_cap: d.fundraising.valuation_cap,
            use_of_funds: d.fundraising.use_of_funds || null,
        },
    }
}

const TABS = [
    { value: "identity", label: "Identity" },
    { value: "problem", label: "Problem" },
    { value: "solution", label: "Solution" },
    { value: "market", label: "Market" },
    { value: "traction", label: "Traction & Team" },
    { value: "fundraising", label: "Fundraising" },
]

/** Radix unmounts inactive TabsContent by default, which makes a whole-form
 *  submit depend on which tab happened to be open. forceMount keeps every input
 *  mounted and the hidden attribute does the visual work instead. */
function Panel({ value, children }: { value: string; children: React.ReactNode }) {
    return (
        <TabsContent
            value={value}
            forceMount
            className="mt-6 data-[state=inactive]:hidden"
        >
            {children}
        </TabsContent>
    )
}

export function SipForm({
    id,
    initial,
    onSave,
}: {
    /** Scopes the recovery draft, so two profiles cannot overwrite each other. */
    id: string
    initial?: Partial<SIP> | null
    onSave: (payload: Partial<SIP>) => Promise<void>
}) {
    const [saving, setSaving] = useState(false)

    const { register, handleSubmit, control, reset, formState } = useForm<
        SipForm,
        unknown,
        SipParsed
    >({
        resolver: zodResolver(sipSchema),
        defaultValues: toDefaults(initial),
    })

    const team = useFieldArray({ control, name: "team" })
    const metrics = useFieldArray({ control, name: "traction.metrics" })

    // Watching the whole form is what makes recovery possible at all: the draft
    // has to reflect the current values, not the ones at mount.
    const values = useWatch({ control }) as SipForm
    const { draft, accept, dismiss, clear } = useFormDraft<SipForm>(id, values, {
        enabled: formState.isDirty,
    })

    useUnsavedChangesWarning(formState.isDirty && !saving)

    const submit = async (data: SipParsed) => {
        setSaving(true)
        try {
            await onSave(toPayload(data))
            // The draft has served its purpose; keeping it risks restoring it
            // over the saved version later.
            clear()
            reset(data as unknown as SipForm)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(submit)}>
            {draft && (
                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <History className="h-4 w-4 shrink-0 text-primary" />
                    <p className="min-w-0 flex-1 text-sm">
                        You have unsaved changes from{" "}
                        {new Date(draft.savedAt).toLocaleString()}.
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                            reset(draft.values, { keepDefaultValues: true })
                            accept()
                        }}
                    >
                        Restore them
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
                        <X className="mr-1.5 h-3 w-3" /> Discard
                    </Button>
                </div>
            )}
            <Tabs defaultValue="identity" className="w-full">
                <TabsList className="w-full">
                    {TABS.map((t) => (
                        <TabsTrigger key={t.value} value={t.value}>
                            {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <Panel value="identity">
                    <Card>
                        <CardHeader className="gap-2">
                            <span className="eyebrow">Identity</span>
                            <CardDescription>Where and when the company exists.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <Field label="Website">
                                <Input placeholder="https://acme.com" {...register("identity.website")} />
                            </Field>
                            <Field label="Location">
                                <Input placeholder="Rotterdam, NL" {...register("identity.location")} />
                            </Field>
                            <Field label="Founded year">
                                <Input type="number" placeholder="2024" {...register("identity.founded_year")} />
                            </Field>
                            <Field label="Contact email">
                                <Input type="email" placeholder="founders@acme.com" {...register("identity.contact_email")} />
                            </Field>
                        </CardContent>
                    </Card>
                </Panel>

                <Panel value="problem">
                    <Card>
                        <CardHeader className="gap-2">
                            <span className="eyebrow">The Problem</span>
                            <CardDescription>What hurts, for whom, and how badly.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Field label="Description">
                                <Textarea rows={4} {...register("problem.description")} />
                            </Field>
                            <Field label="Pain points" hint="Comma separated">
                                <Input placeholder="labour shortage, peak season churn" {...register("problem.pain_points_str")} />
                            </Field>
                            <Field label="Current solutions" hint="What people do today instead">
                                <Textarea rows={3} {...register("problem.current_solutions")} />
                            </Field>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-input"
                                    {...register("problem.validated")}
                                />
                                We have validated this problem with real customers
                            </label>
                        </CardContent>
                    </Card>
                </Panel>

                <Panel value="solution">
                    <Card>
                        <CardHeader className="gap-2">
                            <span className="eyebrow">The Solution</span>
                            <CardDescription>What you built and why it is hard to copy.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Field label="Product name">
                                <Input {...register("solution.product_name")} />
                            </Field>
                            <Field label="Description">
                                <Textarea rows={4} {...register("solution.description")} />
                            </Field>
                            <Field label="Value proposition">
                                <Textarea rows={3} {...register("solution.value_proposition")} />
                            </Field>
                            <Field label="Tech stack" hint="Comma separated">
                                <Input placeholder="ROS2, Rust, Jetson" {...register("solution.tech_stack_str")} />
                            </Field>
                            <Field label="Moat" hint="What stops a funded competitor copying this in six months">
                                <Textarea rows={3} {...register("solution.moat")} />
                            </Field>
                        </CardContent>
                    </Card>
                </Panel>

                <Panel value="market">
                    <Card>
                        <CardHeader className="gap-2">
                            <span className="eyebrow">Market</span>
                            <CardDescription>Figures in USD.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <Field label="TAM" hint="Total addressable market">
                                <Input type="number" placeholder="12000000000" {...register("market.tam")} />
                            </Field>
                            <Field label="SAM" hint="Serviceable addressable market">
                                <Input type="number" {...register("market.sam")} />
                            </Field>
                            <Field label="SOM" hint="Serviceable obtainable market">
                                <Input type="number" {...register("market.som")} />
                            </Field>
                            <Field label="Growth rate" hint="Percent per year">
                                <Input type="number" step="0.1" placeholder="18.5" {...register("market.market_growth_rate")} />
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Target customer persona">
                                    <Textarea rows={3} {...register("market.target_customer_persona")} />
                                </Field>
                            </div>
                        </CardContent>
                    </Card>
                </Panel>

                <Panel value="traction">
                    <div className="grid gap-6">
                        <Card>
                            <CardHeader className="gap-2">
                            <span className="eyebrow">Traction</span>
                            <CardDescription>Numbers first. Vague is a red flag.</CardDescription>
                        </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Metrics</Label>
                                    {/* These rows sit outside Field, so they carry
                                        their own names. A placeholder is not a
                                        label: it disappears the moment you type,
                                        and screen readers may not announce it at
                                        all. Numbered so a row can be identified
                                        when several are on screen. */}
                                    {metrics.fields.map((f, i) => (
                                        <div key={f.id} className="flex gap-2">
                                            <Input
                                                placeholder="MRR"
                                                aria-label={`Metric ${i + 1} name`}
                                                {...register(`traction.metrics.${i}.key` as const)}
                                            />
                                            <Input
                                                type="number"
                                                placeholder="42000"
                                                aria-label={`Metric ${i + 1} value`}
                                                {...register(`traction.metrics.${i}.value` as const)}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Remove metric ${i + 1}`}
                                                onClick={() => metrics.remove(i)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="justify-self-start"
                                        onClick={() => metrics.append({ key: "", value: "" })}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Add metric
                                    </Button>
                                </div>
                                <Field label="Milestones" hint="Comma separated">
                                    <Input placeholder="3 paid pilots, LOI with a top-5 3PL" {...register("traction.milestones_str")} />
                                </Field>
                                <Field label="Customer logos" hint="Comma separated">
                                    <Input {...register("traction.customer_logos_str")} />
                                </Field>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="gap-2">
                            <span className="eyebrow">Team</span>
                            <CardDescription>Founder-market fit, not resumes.</CardDescription>
                        </CardHeader>
                            <CardContent className="grid gap-6">
                                {team.fields.map((f, i) => (
                                    <div key={f.id} className="grid gap-4 rounded-md border p-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Member {i + 1}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => team.remove(i)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <Field label="Name">
                                                <Input {...register(`team.${i}.name` as const)} />
                                            </Field>
                                            <Field label="Role">
                                                <Input placeholder="CEO" {...register(`team.${i}.role` as const)} />
                                            </Field>
                                            <Field label="LinkedIn">
                                                <Input {...register(`team.${i}.linkedin` as const)} />
                                            </Field>
                                            <Field label="Superpower">
                                                <Input placeholder="Ships hardware fast" {...register(`team.${i}.superpower` as const)} />
                                            </Field>
                                        </div>
                                        <Field label="Bio">
                                            <Textarea rows={2} {...register(`team.${i}.bio` as const)} />
                                        </Field>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="justify-self-start"
                                    onClick={() =>
                                        team.append({ name: "", role: "", linkedin: "", bio: "", superpower: "" })
                                    }
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Add team member
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </Panel>

                <Panel value="fundraising">
                    <Card>
                        <CardHeader className="gap-2">
                            <span className="eyebrow">Fundraising</span>
                            <CardDescription>The ask and the deal.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <Field label="Round stage">
                                <Input placeholder="SEED" {...register("fundraising.round_stage")} />
                            </Field>
                            <Field label="Ask amount" hint="USD">
                                <Input type="number" placeholder="3000000" {...register("fundraising.ask_amount")} />
                            </Field>
                            <Field label="Valuation cap" hint="USD">
                                <Input type="number" {...register("fundraising.valuation_cap")} />
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Use of funds">
                                    <Textarea rows={3} {...register("fundraising.use_of_funds")} />
                                </Field>
                            </div>
                        </CardContent>
                    </Card>
                </Panel>
            </Tabs>

            <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 border-t bg-background/85 py-4 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground">
                    {formState.isDirty
                        ? "Unsaved changes, kept in this browser until you save."
                        : "Saving stores every section, whichever tab you are on."}
                </p>
                <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save profile
                </Button>
            </div>
        </form>
    )
}

function Field({
    label,
    hint,
    children,
}: {
    label: string
    hint?: string
    children: React.ReactNode
}) {
    // The label used to be a bare sibling of the control, which looks correct
    // and associates nothing: every input on this form announced as an unnamed
    // edit box. The inputs are registered by `name` and carry no id of their
    // own, so one is minted here and wired up on both ends.
    const generatedId = useId()
    const child = isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
        ? children
        : null
    const id = child?.props.id ?? generatedId
    const hintId = hint ? `${id}-hint` : undefined

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            {child
                ? cloneElement(child, {
                      id,
                      // Hints carry real constraints ("comma separated"), so
                      // they should be read out with the field, not left as
                      // text a screen reader user may never reach.
                      "aria-describedby": hintId,
                  })
                : children}
            {hint && (
                <p id={hintId} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
        </div>
    )
}
