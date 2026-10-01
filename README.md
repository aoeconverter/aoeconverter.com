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
| `/conferences` | Conference deadline list | `src/pages/conferences.astro`, one YAML file per conference in `src/data/conferences/` |
| `/badge/2026-11-15.svg?label=X` | Countdown badge for READMEs/emails | `functions/badge/[name].ts` |
| `/og/2026-11-15.png` | Link-preview image (`/og/default.png` for the site) | `functions/og/[name].ts` |
| `/api/time` | Server time for clock sync (CORS open) | `functions/api/time.ts` |

Every page has the sticky AoE clock (`src/components/AoEClock.astro`). Time logic lives in `src/lib/aoe.ts`. Clock sync lives in `src/lib/timesync.ts`.

## Develop

```sh
npm install
npm test          # unit tests (vitest)
npm run validate  # check conference files (add -- --offline to skip link checks)
npm run dev       # Astro dev server; functions (badge, OG, /d/<date>, /api/time) don't run here
npm run preview   # full build + `wrangler pages dev` on :8788, including functions
npm run deploy    # build + deploy to Cloudflare Pages (needs `wrangler login`)
```

## Conference data

Deadlines come from the community. See [CONTRIBUTING.md](CONTRIBUTING.md) for the file format.

- **Issue form → PR:** `.github/workflows/issue-to-pr.yml` runs `scripts/issue-to-conference.ts` on issues labelled `add-conference`. Valid submissions become a `conf/<slug>` branch and PR; invalid ones get a comment and the `needs-info` label.
- **Checks:** `.github/workflows/validate.yml` runs tests, `npm run validate` (schema, file names, duplicate links, no past deadlines in new files, link reachability) and the build on every PR.
- **Schema:** `src/data/schema.ts`, used by the Astro content collection (`src/content.config.ts`), the validator and the bot. Allowed fields are in `src/data/fields.ts`; keep them in sync with `.github/ISSUE_TEMPLATE/add-conference.yml` (a test checks it).
- Past deadlines are hidden on the client, so the page stays correct between rebuilds.

## Conventions

- A deadline with no time means **23:59:00 AoE**. The countdown reaches zero at the start of that minute.
- `wrangler.toml` `compatibility_date` is capped by the local wrangler's runtime. Raise it when you upgrade wrangler.
