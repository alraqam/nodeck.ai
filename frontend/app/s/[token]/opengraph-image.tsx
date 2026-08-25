import { ImageResponse } from "next/og"
import { fetchPublicProfile } from "@/lib/server-api"

/**
 * The card image an unfurl shows.
 *
 * Generated per link rather than a single static image, because the recipient
 * needs to see *whose* profile they were sent. Drawn in the brand palette by
 * hand: next/og runs a subset of CSS with no Tailwind and no custom
 * properties, so the token values are written out literally here.
 */

export const alt = "Startup profile shared with NoDeck"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const INK = "#0C0D10"
const SURFACE = "#15161A"
const PAPER = "#FAFAF9"
const MUTED = "#9A9CA3"
const AMBER = "#F5A524"

const scoreColour = (n: number) =>
    n >= 70 ? "#3DD68C" : n >= 45 ? AMBER : "#F0655E"

export default async function Image({
    params,
}: {
    params: Promise<{ token: string }>
}) {
    const { token } = await params
    const profile = await fetchPublicProfile(token)

    const name = profile?.name ?? "Profile unavailable"
    const oneLiner = profile?.one_liner ?? ""
    const score = profile?.score?.total_score

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: INK,
                    padding: 72,
                    fontFamily: "sans-serif",
                }}
            >
                {/* The mark as a stack of bars. satori (next/og) renders a small
                    CSS subset - it has no SVG support and ignores absolute
                    positioning - so the stacked cards are flex rows of
                    decreasing width rather than the real geometry. */}
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ width: 42, height: 9, borderRadius: 3, background: PAPER }} />
                        <div
                            style={{
                                width: 36,
                                height: 9,
                                borderRadius: 3,
                                background: PAPER,
                                opacity: 0.55,
                            }}
                        />
                        <div
                            style={{
                                width: 30,
                                height: 9,
                                borderRadius: 3,
                                background: AMBER,
                            }}
                        />
                    </div>
                    <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: PAPER }}>
                        NODECK
                        <span style={{ color: AMBER }}>&nbsp;AI</span>
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div
                        style={{
                            fontSize: name.length > 28 ? 68 : 88,
                            fontWeight: 700,
                            color: PAPER,
                            letterSpacing: -2,
                            lineHeight: 1.05,
                        }}
                    >
                        {name}
                    </div>
                    {oneLiner && (
                        <div style={{ fontSize: 32, color: MUTED, lineHeight: 1.35 }}>
                            {oneLiner.length > 110 ? `${oneLiner.slice(0, 110)}…` : oneLiner}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        borderTop: `1px solid ${SURFACE}`,
                        paddingTop: 28,
                    }}
                >
                    <div style={{ display: "flex", fontSize: 22, color: MUTED, letterSpacing: 2 }}>
                        STARTUP DEAL-FLOW INTELLIGENCE
                    </div>
                    {/* Only when the owner opted the score in - the image must not
                        publish something the page itself would withhold. */}
                    {typeof score === "number" && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <div
                                style={{
                                    fontSize: 76,
                                    fontWeight: 700,
                                    color: scoreColour(score),
                                    letterSpacing: -3,
                                }}
                            >
                                {score}
                            </div>
                            <div style={{ fontSize: 30, color: MUTED }}>/100</div>
                        </div>
                    )}
                </div>
            </div>
        ),
        size,
    )
}
