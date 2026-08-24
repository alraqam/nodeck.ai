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
import { AuthShell, FieldError } from "@/components/auth-shell"
import { api, ApiError, setToken } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const loginSchema = z.object({
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    })

    async function onSubmit(data: LoginForm) {
        setIsLoading(true)
        try {
            const { access_token } = await api.login(data.email, data.password)
            setToken(access_token)
            toast.success("Signed in")
            router.push("/dashboard")
        } catch (error) {
            toast.error("Could not sign in", {
                description:
                    error instanceof ApiError ? error.message : "Please try again.",
            })
            setIsLoading(false)
        }
    }

    return (
        <AuthShell
            eyebrow="Sign in"
            title="Welcome back"
            subtitle="Pick up where your profile left off."
            footer={
                <>
                    No account yet?{" "}
                    <Link href="/register" className="text-foreground underline underline-offset-4">
                        Create one
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        {...register("email")}
                    />
                    <FieldError message={errors.email?.message} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        {...register("password")}
                    />
                    <FieldError message={errors.password?.message} />
                </div>
                <Button className="mt-2 w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign in
                </Button>
            </form>
        </AuthShell>
    )
}
