import type {
    FundabilityAnalysis,
    InvestmentMemo,
    InvestorViewContent,
    PitchDeck,
    Report,
    ScoreBreakdown,
} from "./types"

/**
 * Markdown serialisers for every artefact.
 *
 * Markdown rather than PDF-from-JS: it pastes into Notion, Docs, email and
 * GitHub unchanged, survives editing, and needs no dependency. A PDF is one
 * browser print away and cannot be edited by whoever receives it.
 */

const CRITERIA: [keyof ScoreBreakdown, string][] = [
    ["market_opportunity", "Market opportunity"],
    ["product_solution", "Product / solution"],
    ["traction_execution", "Traction / execution"],
    ["team", "Team"],
    ["moat_risks", "Moat / risks"],
]

const bullets = (items?: string[]) =>
    items?.length ? items.map((i) => `- ${i}`).join("\n") : "_None._"

function scoreToMarkdown(a: Partial<FundabilityAnalysis>, name: string): string {
    const rows = a.breakdown
        ? CRITERIA.map(([k, label]) => `| ${label} | ${a.breakdown![k] ?? 0} / 10 |`).join("\n")
        : ""

    return [
        `# Fundability — ${name}`,
        ``,
        `**${a.total_score} / 100**`,
        ``,
        a.breakdown ? `| Criterion | Score |\n|---|---|\n${rows}` : "",
        ``,
        a.summary ? `## Summary\n\n${a.summary}` : "",
        ``,
        `## Green flags\n\n${bullets(a.green_flags)}`,
        ``,
        `## Red flags\n\n${bullets(a.red_flags)}`,
    ]
        .filter((s) => s !== "")
        .join("\n")
}

function memoToMarkdown(m: Partial<InvestmentMemo>, name: string): string {
    const body = (m.sections ?? [])
        .map((s) => `## ${s.title}\n\n${s.content}`)
        .join("\n\n")
    return [
        `# Investment memo — ${name}`,
        m.recommendation ? `\n**Recommendation: ${m.recommendation}**` : "",
        ``,
        body,
    ]
        .filter((s) => s !== "")
        .join("\n")
}

function deckToMarkdown(d: Partial<PitchDeck>, name: string): string {
    const slides = (d.slides ?? [])
        .map((s, i) => {
            const notes = s.speaker_notes ? `\n> ${s.speaker_notes}` : ""
            return [
                `## ${i + 1}. ${s.title}`,
                ``,
                bullets(s.bullets),
                notes,
            ].join("\n")
        })
        // `---` between slides so the file drops straight into Marp, reveal.js
        // or Slides without re-splitting it by hand.
        .join("\n\n---\n\n")

    return [
        `# ${d.title ?? name}`,
        d.subtitle ? `\n_${d.subtitle}_` : "",
        ``,
        `---`,
        ``,
        slides,
    ]
        .filter((s) => s !== "")
        .join("\n")
}

export function investorViewToMarkdown(
    v: Partial<InvestorViewContent>,
    investorName: string,
    startupName: string,
): string {
    const sections = (v.sections ?? [])
        .map((s) => `## ${s.title}\n\n${s.content}`)
        .join("\n\n")
    return [
        `# ${startupName} — prepared for ${investorName}`,
        v.angle ? `\n**The angle:** ${v.angle}` : "",
        ``,
        sections,
        ``,
        `## Lead with these numbers\n\n${bullets(v.metrics_to_lead_with)}`,
        ``,
        `## Talking points\n\n${bullets(v.talking_points)}`,
    ]
        .filter((s) => s !== "")
        .join("\n")
}

/** Serialise a report by its type. Returns null if there is nothing to export. */
export function reportToMarkdown(report: Report, startupName: string): string | null {
    if (report.status !== "COMPLETED" || !report.content) return null
    switch (report.type) {
        case "FUNDABILITY_SCORE":
            return scoreToMarkdown(report.content, startupName)
        case "INVESTMENT_MEMO":
            return memoToMarkdown(report.content, startupName)
        case "PITCH_DECK":
            return deckToMarkdown(report.content, startupName)
        default:
            return null
    }
}

const SUFFIX: Record<string, string> = {
    FUNDABILITY_SCORE: "fundability",
    INVESTMENT_MEMO: "memo",
    PITCH_DECK: "deck",
}

/** Filesystem-safe, lowercase, no runs of dashes. */
export function slugify(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "nodeck"
    )
}

export function filenameFor(report: Report, startupName: string): string {
    const kind = SUFFIX[report.type] ?? "report"
    const date = report.created_at.slice(0, 10)
    return `${slugify(startupName)}-${kind}-${date}.md`
}

export function downloadMarkdown(filename: string, markdown: string): void {
    const url = URL.createObjectURL(
        new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoking immediately can cancel the download in some browsers; one tick
    // is enough for the click to have been handled.
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        // Clipboard API needs a secure context and permission; fall back to the
        // legacy path so http://localhost over a plain origin still works.
        try {
            const area = document.createElement("textarea")
            area.value = text
            area.style.position = "fixed"
            area.style.opacity = "0"
            document.body.appendChild(area)
            area.select()
            const ok = document.execCommand("copy")
            area.remove()
            return ok
        } catch {
            return false
        }
    }
}
