import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <a href="#main" className="skip-link">
                    Skip to content
                </a>
                <Sidebar />
                {/* min-w-0 stops a wide child (the JSON block, a long table) from
                    forcing the whole page to scroll horizontally. */}
                <main id="main" tabIndex={-1} className="min-w-0 flex-1">
                    <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
                </main>
            </div>
        </AuthGuard>
    )
}
