import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"

/**
 * Replaces Next's default 404, which is an unstyled black-on-white page with
 * no branding and no way back into the app.
 *
 * Wording stays vague about why: a mistyped share link lands here too, and
 * confirming that some address "used to exist" would leak exactly what the
 * public route is careful not to.
 */
export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex h-14 items-center border-b px-6">
                <Link href="/" className="rounded-md">
                    <Logo />
                </Link>
            </header>

            <main className="flex flex-1 items-center justify-center px-6">
                <div className="w-full max-w-md space-y-5 py-16">
                    <p className="font-mono text-5xl font-semibold tabular tracking-tighter text-muted-foreground">
                        404
                    </p>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            This page does not exist
                        </h1>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            The address may be mistyped, or the thing it pointed at may have
                            been deleted.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/dashboard">
                            <Button>Your profiles</Button>
                        </Link>
                        <Link href="/">
                            <Button variant="outline">Home</Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}
