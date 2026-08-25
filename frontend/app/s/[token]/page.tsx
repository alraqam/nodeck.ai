import type { Metadata } from "next"
import {
    SharedProfile,
    SharedProfileUnavailable,
} from "@/components/shared-profile"
import { fetchPublicProfile } from "@/lib/server-api"

type Props = { params: Promise<{ token: string }> }

/**
 * Metadata for the unfurl.
 *
 * A share link is pasted into an email or a chat far more often than it is
 * typed, so what Slack, WhatsApp and LinkedIn show for it is most of the first
 * impression. Without this they fell back to the generic app title, which told
 * the recipient nothing about whose profile they had been sent.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { token } = await params
    const profile = await fetchPublicProfile(token)

    if (!profile) {
        return {
            title: "Link not available",
            // A revoked link must not be indexed or previewed either.
            robots: { index: false, follow: false },
        }
    }

    const title = profile.name ?? "Shared profile"
    const description =
        profile.one_liner ??
        profile.problem.description?.slice(0, 160) ??
        "A startup Intelligence Profile shared with NoDeck."

    return {
        title,
        description,
        // The whole point of a share link is that only the recipient has it.
        robots: { index: false, follow: false },
        openGraph: {
            title,
            description,
            type: "profile",
            siteName: "NoDeck",
        },
        twitter: { card: "summary_large_image", title, description },
    }
}

export default async function SharedProfilePage({ params }: Props) {
    const { token } = await params
    const profile = await fetchPublicProfile(token)

    // A revoked token, a typo and one that never existed all land here
    // identically - the API does not distinguish them either.
    if (!profile) return <SharedProfileUnavailable />

    return <SharedProfile profile={profile} />
}
