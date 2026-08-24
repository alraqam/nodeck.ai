"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { clearToken } from "@/lib/api"
import { LayoutDashboard, LogOut, PlusCircle } from "lucide-react"

const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/startups/new", label: "New Profile", icon: PlusCircle, exact: false },
]

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()

    const logout = () => {
        clearToken()
        router.replace("/login")
    }

    return (
        <div className="flex h-full min-h-screen w-64 flex-col border-r bg-muted/20 px-4 py-8">
            <Link href="/dashboard" className="mb-8 px-2 text-xl font-bold tracking-tight">
                NoDeck
            </Link>
            <nav className="flex flex-1 flex-col space-y-2">
                {links.map((link) => {
                    const Icon = link.icon
                    const active = link.exact
                        ? pathname === link.href
                        : pathname.startsWith(link.href)
                    return (
                        <Link key={link.href} href={link.href}>
                            <Button
                                variant={active ? "secondary" : "ghost"}
                                className="w-full justify-start gap-2"
                            >
                                <Icon className="h-4 w-4" />
                                {link.label}
                            </Button>
                        </Link>
                    )
                })}
            </nav>
            <div className="mt-auto">
                <Button
                    variant="ghost"
                    onClick={logout}
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </Button>
            </div>
        </div>
    )
}
