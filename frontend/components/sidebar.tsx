"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { clearToken } from "@/lib/api"
import { cn } from "@/lib/utils"
import { LayoutGrid, LogOut, Plus } from "lucide-react"

const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
    { href: "/dashboard/startups/new", label: "New profile", icon: Plus, exact: false },
]

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()

    const logout = () => {
        clearToken()
        router.replace("/login")
    }

    return (
        <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r bg-card/40 print:hidden">
            <div className="flex h-14 items-center justify-between border-b px-4">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Logo />
                </Link>
                <ThemeToggle className="h-7 w-7 text-muted-foreground" />
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 p-2">
                {links.map((link) => {
                    const Icon = link.icon
                    const active = link.exact
                        ? pathname === link.href
                        : pathname.startsWith(link.href)
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
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
