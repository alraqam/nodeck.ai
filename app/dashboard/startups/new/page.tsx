"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

// Just enough to create the row. The Intelligence Profile is filled in on the
// next screen, because the SIP is a column ON the startup - an id has to exist
// before it can be attached.
const createSchema = z.object({
    name: z.string().min(1, "Name is required").max(120),
    one_liner: z.string().max(160, "Keep it under 160 characters").optional(),
})

type CreateForm = z.infer<typeof createSchema>

export default function NewStartupPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const { register, handleSubmit, formState: { errors } } = useForm<CreateForm>({
        resolver: zodResolver(createSchema),
    })

    const onSubmit = async (data: CreateForm) => {
        setIsLoading(true)
        try {
            const created = await api.createStartup({
                name: data.name,
                one_liner: data.one_liner || undefined,
            })
            toast.success("Profile created", { description: "Now fill in the details." })
            router.push(`/dashboard/startups/${created.id}/edit`)
        } catch (error) {
            toast.error("Could not create profile", {
                description: error instanceof ApiError ? error.message : "Please try again.",
            })
            setIsLoading(false)
        }
    }

    return (
        <div className="mx-auto max-w-xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">New Profile</h1>
                <p className="text-muted-foreground">Start with the basics.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Company</CardTitle>
                        <CardDescription>
                            You will fill in the full Intelligence Profile next.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Startup name</Label>
                            <Input id="name" placeholder="Acme Robotics" {...register("name")} />
                            {errors.name && (
                                <p className="text-xs text-destructive">{errors.name.message}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="one_liner">One-liner</Label>
                            <Input
                                id="one_liner"
                                placeholder="Warehouse robots as a service"
                                {...register("one_liner")}
                            />
                            {errors.one_liner && (
                                <p className="text-xs text-destructive">{errors.one_liner.message}</p>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push("/dashboard")}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create and continue
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    )
}
