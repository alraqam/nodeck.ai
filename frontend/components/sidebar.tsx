"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Logo, LogoMark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { useEffect, useState } from "react"
import { api, clearToken } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Layers, LayoutGrid, LogOut, Plus } from "lucide-react"

const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
    { href: "/dashboard/startups/new", label: "New profile", icon: Plus, exact: false },
]

const SCREENER_LINK = {
    href: "/dashboard/cohorts",
    label: "Cohorts",
    icon: Layers,
    exact: false,
}

/** Cohorts are only shown to accounts that can use them. The server enforces
 *  this with a 403; hiding the link just avoids offering a dead end. */
function useVisibleLinks() {
    const [screener, setScreener] = useState(false)
    useEffect(() => {
        api.me()
            .then((u) => setScreener(u.role === "ACCELERATOR" || u.role === "ADMIN"))
            .catch(() => setScreener(false))
    }, [])
    return screener ? [...links, SCREENER_LINK] : links
}

function useNav() {
    const pathname = usePathname()
    const router = useRouter()
    return {
        isActive: (href: string, exact: boolean) =>
            exact ? pathname === href : pathname.startsWith(href),
        logout: () => {
            clearToken()
            router.replace("/login")
        },
    }
}

/**
 * The desktop rail.
 *
 * Hidden below `md`. At 375px it was 224px of fixed width leaving 151px for the
 * entire page - the content ended up narrower than the navigation beside it.
 * Phones get MobileNav instead.
 */
export function Sidebar() {
    const { isActive, logout } = useNav()
    const visible = useVisibleLinks()

    return (
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-card/40 md:flex print:hidden">
            <div className="flex h-14 items-center justify-between border-b px-4">
                <Link href="/dashboard" className="flex items-center gap-2 rounded-md py-1">
                    <Logo />
                </Link>
                <ThemeToggle className="h-7 w-7 text-muted-foreground" />
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 p-2">
                {visible.map((link) => {
                    const Icon = link.icon
                    const active = isActive(link.href, link.exact)
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                                active
                                    ? "bg-secondary font-medium text-secondary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {link.label}
                        </Link>
                    )
                })}
            </nav>

            <div className="border-t p-2">
                <Button
                    variant="ghost"
                    onClick={logout}
                    className="w-full justify-start gap-2.5 px-2.5 text-muted-foreground hover:text-foreground"
                >
                    <LogOut className="h-4 w-4" />
                    Log out
                </Button>
            </div>
        </aside>
    )
}

/**
 * The phone bar. Two destinations and a logout do not justify a drawer, so
 * everything stays visible and reachable in one tap.
 */
export function MobileNav() {
    const { isActive, logout } = useNav()
    const visible = useVisibleLinks()

    return (
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur md:hidden print:hidden">
            <div className="flex h-14 items-center justify-between gap-2 px-4">
                <Link href="/dashboard" aria-label="NoDeck home" className="rounded-md p-1">
                    <LogoMark />
                </Link>

                <nav className="flex items-center gap-1">
                    {visible.map((link) => {
                        const Icon = link.icon
                        const active = isActive(link.href, link.exact)
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                aria-current={active ? "page" : undefined}
                                // min-h-11 keeps every target well past the 24px
                                // WCAG minimum on a touch screen.
                                className={cn(
                                    "flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors",
                                    active
                                        ? "bg-secondary font-medium text-secondary-foreground"
                                        : "text-muted-foreground",
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{link.label}</span>
                            </Link>
                        )
                    })}
                    <ThemeToggle className="h-11 w-11 text-muted-foreground" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={logout}
                        aria-label="Log out"
                        className="h-11 w-11 text-muted-foreground"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </nav>
            </div>
        </header>
    )
}
