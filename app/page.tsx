import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"

const CRITERIA = [
    ["01", "Market", "Is the TAM credibly north of $1B?"],
    ["02", "Moat", "What stops a funded competitor copying you in six months?"],
    ["03", "Team", "Founder-market fit and shipped work, not resumes."],
    ["04", "Insight", "The secret you know that the market does not."],
]

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex h-14 items-center justify-between border-b px-6">
                <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-primary" />
                    <span className="text-sm font-semibold tracking-tight">NoDeck</span>
                </div>
                <div className="flex items-center gap-1">
                    <ThemeToggle className="text-muted-foreground" />
                    <Link href="/login">
                        <Button variant="ghost" size="sm">
                            Sign in
                        </Button>
                    </Link>
                </div>
            </header>

            <main className="relative flex flex-1 items-center overflow-hidden">
                <div className="pointer-events-none absolute inset-0 grid-texture opacity-[0.15]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background to-transparent" />

                <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
                    <div>
                        <Badge variant="primary">Fundraising intelligence</Badge>

                        <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                            Stop building slides.
                            <br />
                            <span className="text-muted-foreground">Start building</span>{" "}
                            intelligence.
                        </h1>

                        <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">
                            A deck is a performance. NoDeck replaces it with a structured
                            Intelligence Profile, then puts it in front of a general partner
                            who assumes you will fail — and tells you the score.
                        </p>

                        <div className="mt-9 flex flex-wrap items-center gap-3">
                            <Link href="/register">
                                <Button size="lg">Get your score</Button>
                            </Link>
                            <Link href="/login">
                                <Button size="lg" variant="outline">
                                    Sign in
                                </Button>
                            </Link>
                        </div>

                        <p className="mt-5 font-mono text-xs tracking-wide text-muted-foreground/70">
                            30 is the average applicant &middot; 70 is Series A ready
                        </p>
                    </div>

                    {/* The four criteria are the actual scoring rubric, not marketing
                        copy - they are what the model is told to look for. */}
                    <div className="rounded-lg border bg-card/60 backdrop-blur-sm">
                        <div className="border-b px-5 py-3.5">
                            <span className="eyebrow">What gets judged</span>
                        </div>
                        <ul>
                            {CRITERIA.map(([n, title, body], i) => (
                                <li
                                    key={n}
                                    className={i > 0 ? "border-t px-5 py-4" : "px-5 py-4"}
                                >
                                    <div className="flex gap-4">
                                        <span className="font-mono text-xs text-primary">{n}</span>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">{title}</p>
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                {body}
                                            </p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    )
}
