import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
    resolve: {
        // Mirrors the `@/*` alias in tsconfig.json. Without it, any test that
        // imports through the alias fails to resolve - which only showed up
        // once a test imported something other than its own directory.
        alias: { "@": path.resolve(__dirname, ".") },
    },
    test: {
        include: ["**/*.test.ts", "**/*.test.tsx"],
        exclude: ["node_modules/**", ".next/**"],
    },
})
