# Survey Spark 3

[![PR checks](https://github.com/RajanthaR/survey-spark-3/actions/workflows/pr.yml/badge.svg)](https://github.com/RajanthaR/survey-spark-3/actions/workflows/pr.yml)

Trilingual research survey runner and admin analytics dashboard for EIP Insight.
The app supports English, Sinhala, and Tamil questionnaires, save-and-resume
flows, Supabase-backed response persistence, CSV/XLSX exports, codebooks, and
researcher analytics.

## Ownership

Author: [Rajantha R Ambegala](https://github.com/RajanthaR/)  
Email: rajantha.rc@gmail.com

Copyright (c) 2026 Rajantha R Ambegala. All rights reserved. This repository is
proprietary and fully owned by Rajantha R Ambegala. See [LICENSE](./LICENSE).

## Tech Stack

- TanStack Start, TanStack Router, React 19, Vite
- Supabase Auth and Postgres
- Cloudflare Workers via Wrangler
- Tailwind CSS, Radix UI, lucide-react, framer-motion, Recharts
- Vitest and Playwright

## Requirements

- Bun 1.3.14
- Node.js 24.15.0 when using Node-based tooling
- Supabase project with the migrations in `supabase/migrations`
- Cloudflare account if deploying to Workers

## Setup

```bash
bun install
cp .env.example .env
```

Fill `.env` with your Supabase values. Keep `.env` private; it is ignored by
Git.

Useful scripts:

```bash
bun run dev
bun run typecheck
bun run build
bun run preview
bun run lint
bun run lint:fix
bun run format:check
bun run test
bun run test:e2e
bun run smoke
```

See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) if Bun is missing,
Rollup native loading fails on macOS, or package-manager audit tooling expects
a non-Bun lockfile.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the route map, server
function boundaries, Supabase access rules, and contributor placement guide.

## Environment

Required for local app usage:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`

Optional:

- `VITE_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET`
- `ALLOW_TURNSTILE_BYPASS`
- `BASE_URL`
- `PLAYWRIGHT_BASE_URL`

## Database

Apply Supabase migrations from `supabase/migrations`. A portable schema snapshot
is available in [db/schema.sql](./db/schema.sql), with notes in
[db/README.md](./db/README.md).

## Deployment

The app is configured for Cloudflare Workers with [wrangler.jsonc](./wrangler.jsonc).
Build with:

```bash
bun run build
```

Then deploy using your Cloudflare workflow after configuring production secrets.

## GitHub

This repository is configured with GitHub Actions guardrail workflows in
`.github/workflows`. To connect a remote:

```bash
git remote add origin git@github.com:RajanthaR/survey-spark-3.git
git push -u origin main
```
