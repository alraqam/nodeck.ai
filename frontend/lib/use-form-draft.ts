"use client"

import { useCallback, useEffect, useState } from "react"

const PREFIX = "nodeck:draft:"

/** Bump when the stored shape changes, so an old draft is discarded rather
 *  than restored into a form that no longer matches it. */
const VERSION = 1

// Long enough that a pause in typing settles, short enough that almost nothing
// is lost to a crash.
const DEBOUNCE_MS = 800

// A draft older than this is more likely to confuse than help - the founder has
// probably moved on, and restoring stale answers over fresh ones is worse than
// losing them.
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

type Stored<T> = { version: number; savedAt: number; values: T }

function read<T>(key: string): Stored<T> | null {
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Stored<T>
        if (parsed.version !== VERSION) return null
        if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null
        return parsed
    } catch {
        // Corrupt or unreadable storage must never break the form.
        return null
    }
}

/**
 * Keep an unsaved form recoverable.
 *
 * The Intelligence Profile is a long document filled in over several sittings,
 * and until now a closed tab, a crash or a stray click cost all of it with no
 * warning. This writes the in-progress values to local storage as they change
 * and offers them back on return; the founder decides whether to restore.
 *
 * Storage is per startup, so drafts for different profiles cannot overwrite
 * each other, and it is cleared on a successful save - a draft that outlives
 * the thing it was drafting is just a stale copy waiting to be restored over
 * good data.
 */
export function useFormDraft<T>(
    id: string,
    values: T,
    { enabled = true }: { enabled?: boolean } = {},
) {
    const key = `${PREFIX}${id}`
    const [available, setAvailable] = useState<Stored<T> | null>(null)
    const [dismissed, setDismissed] = useState(false)

    // Look for a draft once, before any keystroke can overwrite it.
    useEffect(() => {
        setAvailable(read<T>(key))
    }, [key])

    // No "skip the first write" guard here, deliberately. An earlier version
    // had one to avoid storing a pristine form, and it silently dropped the
    // very first edit - which for someone who types one sentence and closes
    // the tab is the entire draft. `enabled` is the caller's dirty flag, so by
    // the time this runs the values already differ from the defaults and are
    // worth keeping.
    useEffect(() => {
        if (!enabled) return
        const timer = setTimeout(() => {
            try {
                const payload: Stored<T> = {
                    version: VERSION,
                    savedAt: Date.now(),
                    values,
                }
                window.localStorage.setItem(key, JSON.stringify(payload))
            } catch {
                // Private mode or a full quota. Losing the draft is bad; taking
                // the form down with it is worse.
            }
        }, DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [key, values, enabled])

    const clear = useCallback(() => {
        try {
            window.localStorage.removeItem(key)
        } catch {
            /* nothing useful to do */
        }
        setAvailable(null)
    }, [key])

    const dismiss = useCallback(() => {
        setDismissed(true)
        clear()
    }, [clear])

    return {
        /** A recoverable draft, until it is restored or dismissed. */
        draft: dismissed ? null : available,
        /** Stop offering the draft, keeping it stored. */
        accept: () => setDismissed(true),
        /** Throw the draft away. */
        dismiss,
        /** Remove the draft, e.g. after a successful save. */
        clear,
    }
}

/**
 * Warn before leaving with unsaved changes.
 *
 * Covers a tab close, a reload and navigation away from the site - the cases a
 * router guard cannot see. Browsers ignore any custom message and show their
 * own wording, so none is supplied.
 */
export function useUnsavedChangesWarning(when: boolean) {
    useEffect(() => {
        if (!when) return
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            // Still required by some browsers to trigger the prompt.
            event.returnValue = ""
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [when])
}
