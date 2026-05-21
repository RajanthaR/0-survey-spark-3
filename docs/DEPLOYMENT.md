# Deployment

This app is a TanStack Start application running on Node.js 24, deployed to
Railway via Nixpacks. The Vite build emits `dist/server/server.js` (a
Web-Fetch handler) and `dist/client/*` (static assets). `server-node.mjs`
boots a Node HTTP server using `srvx` that serves the static assets and
delegates everything else to the SSR fetch handler.

## Required Environment

Server-only secrets (Railway service variables):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`
- `TURNSTILE_SECRET`
- `ALLOW_TURNSTILE_BYPASS=false`
- `REDIS_URL` — Railway Redis add-on connection string. Required for
  cross-replica rate limiting; if unset the service silently degrades to a
  per-process in-memory bucket and effective limits diverge across replicas.
- `APP_ENV=production` (or `staging`)
- `NODE_ENV=production`

Client build-time values (must be present at build, not just runtime):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_TURNSTILE_SITE_KEY`

Runtime networking (Railway injects `PORT` automatically):

- `PORT` (default `3000` for local runs)
- `HOSTNAME` (default `0.0.0.0`)

GitHub nightly deploy-gate inputs:

- Repository variables: `STAGING_BASE_URL`, `STAGING_SUPABASE_URL`,
  `STAGING_SUPABASE_PUBLISHABLE_KEY`, `STAGING_ADMIN_BOOTSTRAP_EMAIL`,
  `STAGING_TURNSTILE_SITE_KEY`
- Repository secrets: `STAGING_SUPABASE_SERVICE_ROLE_KEY`,
  `STAGING_TURNSTILE_SECRET`
- For schema drift: either `STAGING_SUPABASE_DB_URL` or
  `STAGING_SUPABASE_ACCESS_TOKEN`

Never expose `SUPABASE_SERVICE_ROLE_KEY` or database connection strings to the
browser bundle.

## Pre-deploy Checklist

1. Apply pending `supabase/migrations` to staging.
2. Confirm Supabase Auth settings:
   - Confirm email: ON (`autoconfirm=false`)
   - Leaked password protection: ON
   - Anonymous sign-ins: OFF
3. Confirm Cloudflare Turnstile site and secret keys are configured.
4. Run the local gate:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint -- --max-warnings 0
bun run format:check
bun run test
bun run build
bun run deploy:preflight
bun run db:diff:check
```

`bun run deploy:preflight` rejects missing Supabase/Turnstile/admin env, invalid
bootstrap email, `ALLOW_TURNSTILE_BYPASS=true`, and Supabase Auth email
auto-confirm.

## Deploy

Railway builds with Bun and runs with Node 24, driven by `nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["bun", "nodejs_24"]

[phases.install]
cmds = ["bun install --frozen-lockfile"]

[phases.build]
cmds = ["bun run build"]

[start]
cmd = "node server-node.mjs"
```

Either push to the connected GitHub branch or run `railway up`. After the
deploy succeeds, capture the deployment ID, commit SHA, operator, and
timestamp in the release log.

For production, configure the Railway service:

- Region: pick one close to the Supabase region for low server-fn latency.
- Replicas: any count, since rate-limit state is in Redis.
- Healthcheck: HTTP `GET /` expecting 2xx.
- Custom domain (optional): add to Supabase Auth Site/Redirect URLs and to
  the Cloudflare Turnstile site-key allowlist before promoting traffic.

A local equivalent of the Railway runtime:

```bash
bun install --frozen-lockfile
bun run build
PORT=4173 node server-node.mjs
```

## Post-deploy Checklist

Run smoke against the deployed URL:

```bash
BASE_URL=https://your-domain.example bun run smoke
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_PUBLISHABLE_KEY=... \
bun run smoke:db
```

Confirm:

- `/` returns 200 and non-blank HTML.
- `/admin` renders the unauthenticated admin shell without SSR failure.
- Security headers include HSTS, CSP nonce, Permissions-Policy,
  Referrer-Policy, X-Content-Type-Options, and X-Frame-Options.
- Supabase Auth email confirmation remains enabled.
- An anon/publishable-key insert into `public.responses` is denied.
- Railway service logs show no new 500s after smoke.
- Admin exports still produce request IDs and checksums.
- Rate-limit log line `[rate-limit] Redis call failed` does NOT appear under
  normal load. It appears only when Redis is genuinely unreachable, in which
  case the service has degraded to per-replica in-memory limiting.

## Database And Drift

`supabase/migrations/` is the live source of truth. `db/schema.sql` is a
portable reference snapshot with a dated comparison header. Run:

```bash
bun run db:diff
```

Use `bun run db:diff:check` in CI or release gates. The script writes reports to
`test-results/db-diff/` and fails in check mode when Supabase reports drift.

## Rollback

If the Railway deploy fails smoke or causes a production incident:

1. Stop further deploys.
2. In the Railway dashboard, open the service Deployments tab and click
   "Rollback" on the previous successful deployment, or run
   `railway rollback` with the prior deployment ID.
3. Re-run `BASE_URL=<prod-url> bun run smoke`.
4. If a database migration caused data or access issues, use Supabase PITR
   only after confirming the blast radius and export impact.
5. Preserve request IDs, Railway deployment IDs, migration names, and
   timestamps for the incident record.

## Runtime Upgrade Policy

Node 24 and Bun 1.3 are pinned in `nixpacks.toml`, `engines` (in
`package.json`), `.nvmrc`, and `.tool-versions`. Bump them only in a
dedicated PR after running build, SSR smoke, DB smoke, and staging admin
export checks. Treat a runtime upgrade as a deploy gate, not a maintenance
chore.

## Related Runbooks

- `RESEARCHER_OPS.md` for launch, monitoring, export, and closeout.
- `ADMIN_ONBOARDING.md` for first login, admin role grants, and recovery.
- `BACKUP_RESTORE.md` for PITR, manual backups, restore drills, and redaction.
- `SECURITY.md` for vulnerability disclosure and incident expectations.
