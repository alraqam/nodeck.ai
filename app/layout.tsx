import type { Metadata } from "next"
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"

// Plex Sans matches the brand kit's grotesque wordmark far better than a
// geometric face, and pairs with Plex Mono below by construction.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
})

// Mono carries the data: every score, metric and eyebrow label uses it. It is
// what makes the product read as an instrument rather than a pitch surface.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "NoDeck | AI Fundraising Intelligence",
  description: "Stop building slides. Start building intelligence.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          plexSans.variable,
          mono.variable,
        )}
      >
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
