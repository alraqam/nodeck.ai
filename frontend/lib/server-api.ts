import "server-only"

import { headers } from "next/headers"

import type { PublicProfile } from "./types"

/**
 * Server-side fetch for the shared profile.
 *
 * The browser client in lib/api.ts calls "/api/…" and relies on the Next
 * rewrite, which only exists inside the browser. On the server there is no
 * rewrite, so this talks to the backend origin directly.
 */
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000"

/**
 * Pass the visitor's address through to the backend.
 *
 * Since this page is server-rendered, every visitor reaches the API from this
 * server's address. Without forwarding, the backend's per-client rate limit
 * sees one caller for the entire site and throttles real users instead of
 * abuse. The backend only honours this when TRUST_PROXY_HEADERS is set, which
 * must be true only where the API is unreachable except through this app or a
 * proxy - otherwise anyone could forge the header and evade the limit.
 */
async function clientAddressHeaders(): Promise<Record<string, string>> {
  try {
    const incoming = await headers()
    const forwarded =
      incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip")
    return forwarded ? { "X-Forwarded-For": forwarded } : {}
  } catch {
    // Called outside a request scope (a build-time render, say). No visitor to
    // attribute the call to, so send nothing.
    return {}
  }
}

export async function fetchPublicProfile(
  token: string,
): Promise<PublicProfile | null> {
  try {
    const res = await fetch(
      `${BACKEND_ORIGIN}/api/v1/public/${encodeURIComponent(token)}`,
      {
        // The owner can edit the profile or revoke the link at any moment, and
        // a stale share page could show data that was meant to be withdrawn.
        // Correctness beats a cache hit here.
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(await clientAddressHeaders()),
        },
      },
    )
    if (!res.ok) return null
    return (await res.json()) as PublicProfile
  } catch {
    // The backend being down must render "not available" rather than a crash:
    // this page is shown to someone with no account and no way to debug it.
    return null
  }
}
