# aoeconverter.com

The current time Anywhere on Earth (AoE, UTC−12), synced to the second, plus tools for AoE deadlines.

Astro static site on Cloudflare Pages, with Pages Functions for the dynamic parts.

## Routes

| Route | What it is | Source |
|---|---|---|
| `/` | Big AoE clock and a deadline checker | `src/pages/index.astro` |
| `/convert` | AoE ⇄ any timezone | `src/pages/convert.astro` |
| `/d/2026-11-15?t=23:59&name=X` | Shareable countdown, .ics, Google Calendar, badge | `src/pages/d.astro` + `functions/d/[date].ts` (per-link title/OG tags) |
| `/is-it-still/2026-11-15` | "Is it still this date anywhere?" | `src/pages/is-it-still.astro` + `functions/is-it-still/[date].ts` |
| `/embed` | Generator for the embeddable countdown | `src/pages/embed.astro` |
| `/embed/v1.js` | The embed script (~3 KB gz, Shadow DOM, no cookies) | `src/embed/index.ts` |
| `/conferences` | Conference deadline list | `src/pages/conferences.astro`, data in `src/data/conferences.json` |
| `/badge/2026-11-15.svg?label=X` | Countdown badge for READMEs/emails | `functions/badge/[name].ts` |
| `/og/2026-11-15.png` | Link-preview image (`/og/default.png` for the site) | `functions/og/[name].ts` |
| `/api/time` | Server time for clock sync (CORS open) | `functions/api/time.ts` |

Every page has the sticky AoE clock (`src/components/AoEClock.astro`). Time logic lives in `src/lib/aoe.ts`. Clock sync lives in `src/lib/timesync.ts`.

## Develop

```sh
npm install
npm test          # unit tests (vitest)
npm run dev       # Astro dev server; functions (badge, OG, /d/<date>, /api/time) don't run here
npm run preview   # full build + `wrangler pages dev` on :8788, including functions
npm run deploy    # build + deploy to Cloudflare Pages (needs `wrangler login`)
```

## Conference data

`src/data/conferences.json` only holds **sample entries** (`"example": true`, shown with a "Sample entry" tag). Replace them with real, verified deadlines before launch. Past deadlines are hidden on the client, so the page stays correct between rebuilds.

## Conventions

- A deadline with no time means **23:59:00 AoE**. The countdown reaches zero at the start of that minute.
- `wrangler.toml` `compatibility_date` is capped by the local wrangler's runtime. Raise it when you upgrade wrangler.
