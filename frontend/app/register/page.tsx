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
import { api, ApiError } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const registerSchema = z.object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    // Matches the backend's min_length=8.
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
        <AuthShell
            eyebrow="Create account"
            title="Get your score"
            subtitle="Build the profile once. Score it as often as you like."
            footer={
                <>
                    Already have an account?{" "}
                    <Link href="/login" className="text-foreground underline underline-offset-4">
                        Sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                        id="fullName"
                        autoComplete="name"
                        placeholder="Ada Lovelace"
                        {...register("fullName")}
                    />
                    <FieldError message={errors.fullName?.message} />
                </div>
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
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        {...register("password")}
                    />
                    <FieldError message={errors.password?.message} />
                </div>
                <Button className="mt-2 w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create account
                </Button>
            </form>
        </AuthShell>
    )
}
