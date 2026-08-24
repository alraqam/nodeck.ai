"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api"

const registerSchema = z.object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
    })

    async function onSubmit(data: RegisterForm) {
        setIsLoading(true)
        try {
            // `role` is not sent: the backend always creates a FOUNDER and
            // ignores a client-supplied role.
            await api.register({
                email: data.email,
                password: data.password,
                full_name: data.fullName,
            })
            toast.success("Account created", { description: "You can sign in now." })
            router.push("/login")
        } catch (error) {
            toast.error("Could not create account", {
                description:
                    error instanceof ApiError ? error.message : "Please try again.",
            })
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Create an account</CardTitle>
                    <CardDescription>
                        Enter your information to get started.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" placeholder="John Doe" {...register("fullName")} />
                            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="m@example.com" {...register("email")} />
                            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" {...register("password")} />
                            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button className="w-full" disabled={isLoading}>
                            {isLoading ? "Creating account..." : "Create account"}
                        </Button>
                        <div className="text-center text-sm">
                            Already have an account?{" "}
                            <Link href="/login" className="underline">
                                Sign in
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
