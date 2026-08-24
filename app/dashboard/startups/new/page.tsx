"use client"

import { useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea" // Need to create TextArea
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

// We need a partial schema here matching the backend SIP
const startupSchema = z.object({
    name: z.string().min(1, "Name is required"),
    one_liner: z.string().max(100, "Keep it short"),
    identity: z.object({
        website: z.string().url().optional().or(z.literal("")),
        location: z.string().min(1, "Location required"),
    }),
    problem: z.object({
        description: z.string().min(20, "Please elaborate"),
        // pain_points array handling is complex in pure HTML forms, using comma separated for MVP
        pain_points_str: z.string(),
    }),
    // ... simplified for MVP
})

export default function NewStartupPage() {
    const methods = useForm({
        // resolver: zodResolver(startupSchema), // Skip strict validation for partial saving MVP
    })

    const onSubmit = async (data: any) => {
        // Transform arrays
        const formattedData = {
            ...data,
            slug: data.name.toLowerCase().replace(/ /g, "-"),
            // Transform pain_points_str -> array
        }

        // Call API
        toast.info("Saving profile...", { description: "Connecting to backend..." })

        try {
            const token = localStorage.getItem("token")
            const res = await fetch("/api/startups", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(formattedData)
            })
            if (!res.ok) throw new Error("Failed to create")
            toast.success("Startup Created!")
            // Redirect to dashboard
        } catch (e) {
            toast.error("Error creating startup")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Create Startup Profile</h1>
            </div>

            <FormProvider {...methods}>
                <form onSubmit={methods.handleSubmit(onSubmit)}>
                    <Tabs defaultValue="basics" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="basics">Basics</TabsTrigger>
                            <TabsTrigger value="problem">Problem</TabsTrigger>
                            <TabsTrigger value="solution">Solution</TabsTrigger>
                            <TabsTrigger value="market">Market</TabsTrigger>
                        </TabsList>

                        <div className="mt-6">
                            <TabsContent value="basics">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Startup Identity</CardTitle>
                                        <CardDescription>The fundamentals of your company.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label>Startup Name</Label>
                                            <Input {...methods.register("name")} placeholder="Acme Inc." />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>One Liner</Label>
                                            <Input {...methods.register("one_liner")} placeholder="Uber for X" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Website</Label>
                                            <Input {...methods.register("identity.website")} placeholder="https://..." />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Location</Label>
                                            <Input {...methods.register("identity.location")} placeholder="San Francisco" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="problem">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>The Problem</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label>Description</Label>
                                            <Textarea
                                                {...methods.register("problem.description")}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Other tabs omitted for brevity in this step, easy to add */}
                        </div>

                        <div className="mt-6 flex justify-end gap-4">
                            <Button variant="outline">Back</Button>
                            <Button type="submit">Save & Continue</Button>
                        </div>
                    </Tabs>
                </form>
            </FormProvider>
        </div>
    )
}
