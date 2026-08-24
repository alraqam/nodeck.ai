# NoDeck Frontend

Next.js 16 (App Router), TypeScript, Tailwind v4, Radix primitives.

```bash
npm install
npm run dev          # http://localhost:3000
```

The backend must be running on port 8000. `next.config.ts` rewrites `/api/*`
to `http://127.0.0.1:8000/api/v1/*`, so the browser only ever talks to this
origin and CORS never enters the picture in development. Point it elsewhere
with `BACKEND_ORIGIN`.

## Layout

```
app/                       routes; dashboard/startups/[id] is the main screen
components/
  report-viewer.tsx        fundability score - the product's hero moment
  memo-viewer.tsx          investment memo
  deck-viewer.tsx          generated slides
  investor-views.tsx       per-investor retellings, with their own polling
  deck-upload.tsx          PDF drop zone
  sip-form.tsx             the Intelligence Profile editor
  sip-summary.tsx          read-only profile view
  logo.tsx                 brand mark, inlined
lib/
  api.ts                   typed client; one place handles 401 -> /login
  types.ts                 mirrors the backend schemas
  use-reports.ts           report list, generation and polling for all types
```

## Notes

**Generation is polled.** `useReports()` owns the report list, in-flight
generations and the polling for all three report types at once — they differ
only in endpoint and the noun in a toast, so one implementation means a fix to
the polling logic cannot land for scores and be forgotten for decks. It also
resumes anything left `PENDING` by a refresh mid-generation.

Polling uses a recursive `setTimeout`, not `setInterval`: a slow response must
not let requests stack up on top of each other.

**Theming.** Tokens live in `app/globals.css` as complete colours, not bare
HSL triplets, because Tailwind v4 consumes them directly — `bg-primary/90` only
works if the token already resolves. Dark is the default. Two amber tokens
exist on purpose: `--brand` is pinned to the brand value for the logo and
brand fills, while `--primary` deepens in light mode, because brand amber only
reaches about 2.1:1 on white and fails contrast for anything but a filled
block.

**Brand assets** in `public/brand/` come from the official kit. The mark is
inlined in `logo.tsx` with its geometry copied verbatim — the cards paint with
`currentColor` so it inverts with the theme, while the amber node graph stays
fixed. Do not redraw it by eye.
