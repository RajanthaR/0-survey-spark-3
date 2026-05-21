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
- Node.js 24 runtime (Railway via Nixpacks); Redis-backed rate limiter
- Tailwind CSS, Radix UI, lucide-react, framer-motion, Recharts
- Vitest and Playwright

## Requirements

- Bun 1.3.14 (build)
- Node.js 24.15.0 (runtime + Node-based tooling)
- Supabase project with the migrations in `supabase/migrations`
- Redis instance for the production rate limiter (Railway Redis add-on works)

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
- `REDIS_URL` (required in production for cross-replica rate limiting)
- `PORT` / `HOSTNAME` (Railway injects `PORT` automatically)
- `BASE_URL`
- `PLAYWRIGHT_BASE_URL`

## Database

Apply Supabase migrations from `supabase/migrations`. A portable schema snapshot
is available in [db/schema.sql](./db/schema.sql), with notes in
[db/README.md](./db/README.md).

## Deployment

The app deploys to Railway as a Node.js service. The build emits `dist/server/server.js`
(Web-Fetch handler) and `dist/client/*` (static assets); `server-node.mjs` boots a Node
HTTP server via `srvx` that wraps both.

```bash
bun install --frozen-lockfile
bun run build
node server-node.mjs
```

Railway uses `nixpacks.toml` to install with Bun and run with Node 24. Set the
service variables listed in [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) before
deploying. Add a Redis add-on in the same Railway project and set `REDIS_URL`
on the service.

## GitHub

This repository is configured with GitHub Actions guardrail workflows in
`.github/workflows`. To connect a remote:

```bash
git remote add origin git@github.com:RajanthaR/survey-spark-3.git
git push -u origin main
```
