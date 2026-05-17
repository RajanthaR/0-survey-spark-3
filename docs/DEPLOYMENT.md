# Deployment

This app is a TanStack Start application targeting Cloudflare Workers.

## Production Checklist

- Create or select the Supabase project.
- Apply `supabase/migrations`.
- Configure Supabase Auth email confirmation and password protection.
- Set `ADMIN_BOOTSTRAP_EMAIL` to the owner/admin email before first login.
- Set Cloudflare Worker secrets for server-only values.
- Set `APP_ENV=production` (or `ENVIRONMENT=production`) on the deployed Worker so production boot guards are active.
- Set Vite build-time variables for public client values.
- Ensure the `RATE_LIMIT` Durable Object binding and `RateLimitDO` migration from `wrangler.jsonc` are deployed.
- Run `bun run build` before deployment.
- Run `bun run smoke` against the deployed URL after deployment.

## Secrets

Server-only:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`
- `TURNSTILE_SECRET` (required when `APP_ENV=production`)
- `ALLOW_TURNSTILE_BYPASS=false` in production; `true` is only for internal preview/dev testing

Client build-time:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_TURNSTILE_SITE_KEY` if Turnstile is enabled

## Database

The live database should be managed from `supabase/migrations`. `db/schema.sql`
is a portable reference snapshot for review, local Postgres experiments, and
drift checks.

The stale-response cron migration requires `pg_cron` and schedules
`public.expire_stale_responses()` daily at 03:00 UTC. It marks `in_progress`
responses older than 30 days as `expired`.

## Security Headers

Security headers are emitted per request from TanStack Start middleware:
HSTS, Permissions-Policy, Referrer-Policy, X-Content-Type-Options,
X-Frame-Options, and a nonce-based CSP. `script-src` does not allow
`'unsafe-inline'`; `style-src 'unsafe-inline'` remains temporarily for the
current Tailwind/runtime style surface and is tracked for later tightening
under D-11.

## Smoke Test

```bash
BASE_URL=https://your-domain.example bun run smoke
```

The smoke test checks the main public routes and admin route for SSR failures,
blank HTML, error envelopes, required security headers, and the CSP nonce
contract.
