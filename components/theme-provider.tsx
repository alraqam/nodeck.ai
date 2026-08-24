"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Dark by default. This is a deliberate identity choice, not a preference:
 * the product is an analyst's instrument, and the score ramp reads with far
 * more force against a near-black canvas. Light mode is fully supported.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
