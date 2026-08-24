"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getToken } from "@/lib/api"

/**
 * Keeps logged-out users out of the dashboard.
 *
 * This is UX routing, NOT security: the token lives in localStorage, which
 * Next middleware (edge runtime, cookies only) cannot see. Every real
 * authorisation check happens in the backend's get_current_user. Keeping the
 * logic here in one component is what makes a later move to httpOnly cookies
 * a two-file change.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login")
      return
    }
    setChecked(true)
  }, [router])

  if (!checked) return null
  return <>{children}</>
}
