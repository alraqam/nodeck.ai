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
                <Sidebar />
                <main className="flex-1 p-8">
                    {children}
                </main>
            </div>
        </AuthGuard>
    )
}
