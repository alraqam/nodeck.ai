"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ReportViewer } from "@/components/report-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

export default function StartupDetailPage() {
    const params = useParams()
    const id = params.id

    const [startup, setStartup] = useState<any>(null)
    const [reports, setReports] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [analyzing, setAnalyzing] = useState(false)

    useEffect(() => {
        fetchData()
    }, [id])

    const fetchData = async () => {
        const token = localStorage.getItem("token")
        try {
            // Fetch Startup
            const resStartup = await fetch(`/api/startups/${id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            if (!resStartup.ok) throw new Error("Failed to load startup")
            const startupData = await resStartup.json()
            setStartup(startupData)

            // Fetch Reports (Mocking endpoint for now or need to create it)
            // For MVP, we will store reports in local state or fetch from a hypothetical endpoint
            // Let's assume we can fetch reports. For now, empty list.
            setReports([])
        } catch (e) {
            toast.error("Error loading data")
        } finally {
            setLoading(false)
        }
    }

    const triggerAnalysis = async () => {
        setAnalyzing(true)
        const token = localStorage.getItem("token")
        try {
            const res = await fetch(`/api/analysis/${id}/fundability`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            })
            if (!res.ok) throw new Error("Failed to start analysis")
            const data = await res.json()
            toast.success("Analysis started!", { description: "You will come back to check results later (Async)." })

            // In a real app, we'd poll for status. 
            // For this demo, we'll mimic a quick completion or just show pending state.
        } catch (e) {
            toast.error("Failed to trigger analysis")
        } finally {
            setAnalyzing(false)
        }
    }

    if (loading) return <div>Loading...</div>
    if (!startup) return <div>Startup not found</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{startup.name}</h1>
                    <p className="text-muted-foreground">{startup.one_liner}</p>
                </div>
                <Button onClick={triggerAnalysis} disabled={analyzing}>
                    {analyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Analyze Fundability
                </Button>
            </div>

            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="intelligence">Intelligence Profile</TabsTrigger>
                    <TabsTrigger value="reports">Reports & Memos</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fundability Score</CardTitle>
                            <CardDescription>AI-generated assessment based on your profile.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {reports.length > 0 ? (
                                <ReportViewer report={reports[0]} />
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border-dashed border rounded-md">
                                    <p className="mb-4">No analysis generated yet.</p>
                                    <Button variant="outline" onClick={triggerAnalysis}>Run Analysis</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="intelligence">
                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-[500px]">
                        <pre className="text-xs">{JSON.stringify(startup.sip_data, null, 2)}</pre>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
