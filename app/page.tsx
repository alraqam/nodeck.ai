import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
        NoDeck
      </h1>
      <p className="text-xl text-muted-foreground">
        Stop building slides. Start building intelligence.
      </p>
      <div className="flex gap-4">
        <Link href="/login">
          <Button size="lg">Login</Button>
        </Link>
        <Link href="/register">
          <Button variant="outline" size="lg">
            Register
          </Button>
        </Link>
      </div>
    </div>
  );
}
