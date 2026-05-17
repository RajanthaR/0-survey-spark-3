# Database And Deployment Audit

## Current State

The database layer uses Supabase migrations as the live source of truth and `db/schema.sql` as a portable snapshot. Deployment targets Cloudflare Workers via Wrangler and Vite's Cloudflare plugin. Environment variables are documented in `.env.example`, `README.md`, and `docs/DEPLOYMENT.md`.

## Findings

- `db/README.md` clearly states that migrations win if `db/schema.sql` drifts.
- Migrations enable RLS, create admin read policies, add realtime/replica identity, and add `preview_bypass`.
- `db/schema.sql` is intentionally portable and does not exactly match Supabase migrations, so regeneration policy matters.
- Wrangler config points to `src/server.ts`, while Vite config comments explain TanStack Start server entry behavior for Cloudflare builds.
- `.env.example` includes Supabase, Turnstile, base URL, Playwright, and optional image generation settings.
- `docs/DEPLOYMENT.md` exists but should be reviewed against current blockers and production secret expectations.
- SSR smoke script exists, but cannot be used locally until a server can start.
- Production deploy should fail early if critical env vars are missing rather than relying on runtime errors.

## Suggested Improvements

- Add a deployment preflight checklist: install runtime, verify lockfile install, set Supabase secrets, set Turnstile secrets, run typecheck/lint/build/test/smoke.
- Add an env validation note for production: fail or alert if `TURNSTILE_SECRET` is missing and bot protection is expected.
- Regenerate or review `db/schema.sql` after migrations change, or add a dated "last compared" note.
- Add a migration verification step to CI or release checklist.
- Document Cloudflare Worker compatibility assumptions: `nodejs_compat`, server entry, service-role secrets, and streaming export behavior.
- Add smoke-test examples for local preview and deployed URL.
- Document Supabase Auth settings: confirm email on, leaked password protection on, anonymous sign-ins off.

## Priority

- P0: Production env and Turnstile preflight policy.
- P1: Deployment checklist and smoke-test procedure.
- P1: Schema/migration drift review process.
- P2: CI migration/deploy checks.

## Verification

- `db/README.md` already documents migration-vs-schema source of truth and Supabase Auth settings.
- `wrangler.jsonc` uses `compatibility_flags: ["nodejs_compat"]`.
- Local build and smoke tests are blocked by Rollup native loading and missing Bun.

## Related Files

- `db/README.md`
- `db/schema.sql`
- `supabase/migrations/`
- `supabase/config.toml`
- `wrangler.jsonc`
- `vite.config.ts`
- `src/server.ts`
- `.env.example`
- `docs/DEPLOYMENT.md`
- `scripts/smoke-ssr.mjs`
