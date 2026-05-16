# Deployment

This app is a TanStack Start application targeting Cloudflare Workers.

## Production Checklist

- Create or select the Supabase project.
- Apply `supabase/migrations`.
- Configure Supabase Auth email confirmation and password protection.
- Set `ADMIN_BOOTSTRAP_EMAIL` to the owner/admin email before first login.
- Set Cloudflare Worker secrets for server-only values.
- Set Vite build-time variables for public client values.
- Run `bun run build` before deployment.
- Run `bun run smoke` against the deployed URL after deployment.

## Secrets

Server-only:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`
- `TURNSTILE_SECRET` if Turnstile is enabled
- `ALLOW_TURNSTILE_BYPASS=false` in production

Client build-time:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_TURNSTILE_SITE_KEY` if Turnstile is enabled

## Database

The live database should be managed from `supabase/migrations`. `db/schema.sql`
is a portable reference snapshot for review, local Postgres experiments, and
drift checks.

## Smoke Test

```bash
BASE_URL=https://your-domain.example bun run smoke
```

The smoke test checks the main public routes and admin route for SSR failures,
blank HTML, and error envelopes.
