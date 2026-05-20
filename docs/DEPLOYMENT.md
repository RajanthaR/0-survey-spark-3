# Deployment

This app is a TanStack Start application targeting Cloudflare Workers.

## Required Environment

Server-only Worker secrets:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`
- `TURNSTILE_SECRET`
- `ALLOW_TURNSTILE_BYPASS=false`

Client build-time values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_TURNSTILE_SITE_KEY`

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

Deploy with Wrangler from a shell that has the production Worker secrets set in
Cloudflare, not in the browser build environment:

```bash
bunx wrangler deploy
```

Expected output includes the Worker name, uploaded version, and deployed route
or workers.dev URL. Record the deploy SHA, Worker version, operator, and time in
the release log.

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
- Cloudflare Worker logs show no new 500s after smoke.
- Admin exports still produce request IDs and checksums.

## Database And Drift

`supabase/migrations/` is the live source of truth. `db/schema.sql` is a
portable reference snapshot with a dated comparison header. Run:

```bash
bun run db:diff
```

Use `bun run db:diff:check` in CI or release gates. The script writes reports to
`test-results/db-diff/` and fails in check mode when Supabase reports drift.

## Rollback

If the Worker deploy fails smoke or causes a production incident:

1. Stop further deploys.
2. Roll back to the previous Cloudflare Worker version in the Cloudflare
   dashboard or with Wrangler version rollback tooling available for the
   account.
3. Re-run `BASE_URL=<prod-url> bun run smoke`.
4. If a database migration caused data or access issues, use Supabase PITR only
   after confirming the blast radius and export impact.
5. Preserve request IDs, Worker version IDs, migration names, and timestamps for
   the incident record.

## Compatibility Date Policy

`wrangler.jsonc` pins `compatibility_date`. Bump it only in a dedicated PR after
running build, SSR smoke, DB smoke, and staging admin export checks. Treat a
compatibility-date change like a runtime upgrade.

## Related Runbooks

- `RESEARCHER_OPS.md` for launch, monitoring, export, and closeout.
- `ADMIN_ONBOARDING.md` for first login, admin role grants, and recovery.
- `BACKUP_RESTORE.md` for PITR, manual backups, restore drills, and redaction.
- `SECURITY.md` for vulnerability disclosure and incident expectations.
