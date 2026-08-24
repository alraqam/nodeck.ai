"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, PlusCircle, FileText, Settings, LogOut } from "lucide-react"

export function Sidebar() {
    const pathname = usePathname()

    const links = [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/startups/new", label: "New Startup Profile", icon: PlusCircle },
        { href: "/dashboard/reports", label: "Reports", icon: FileText },
        { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ]

    return (
        <div className="flex h-full min-h-screen w-64 flex-col border-r bg-muted/20 px-4 py-8">
            <div className="mb-8 px-2 text-xl font-bold tracking-tight">
                NoDeck
            </div>
            <nav className="flex flex-1 flex-col space-y-2">
                {links.map((link) => {
                    const Icon = link.icon
                    return (
                        <Link key={link.href} href={link.href}>
                            <Button
                                variant={pathname === link.href ? "secondary" : "ghost"}
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
                <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive">
                    <LogOut className="h-4 w-4" />
                    Logout
                </Button>
            </div>
        </div>
    )
}
