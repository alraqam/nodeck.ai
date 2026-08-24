import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
                <Link href="/dashboard/startups/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Profile
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Your Startups</CardTitle>
                        <CardDescription>Manage your intelligent profiles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                            No startups created yet.
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Reports</CardTitle>
                        <CardDescription>Latest scores and memos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                            No reports generated.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
