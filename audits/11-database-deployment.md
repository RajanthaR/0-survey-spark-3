# Audit 11 — Database & Deployment

(Added 2026-05-17 to bring my audit set to parity with the Codex-audits package.)

Scope: Supabase migrations, `db/schema.sql` portable snapshot, RLS, Cloudflare Worker target, env preflight, smoke tests, rollback.

## Strengths

- **Migrations are the source of truth.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/db/README.md` documents that `db/schema.sql` is a portable reference and migrations win on drift.
- **RLS enabled on `responses` + `user_roles`.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/supabase/migrations/20260514192711_b5105764-05be-44ec-b438-6796a4847895.sql:23-58`.
- **Service-definer helper for role checks** avoids recursive RLS lookups (`db/schema.sql:35-58`).
- **Cloudflare Worker target is documented.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/wrangler.jsonc` enables `nodejs_compat`; `vite.config.ts` uses `@cloudflare/vite-plugin`.
- **Env split is documented.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/.env.example` + `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/docs/DEPLOYMENT.md:1-46` separate server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`) from public client values (`VITE_*`).

## Findings

### DB-1 — `db/schema.sql` drifts from migrations and the drift is undated _(medium)_

`db/schema.sql` is a hand-curated portable snapshot, while `supabase/migrations/*.sql` is what actually shapes the live database. The README warns about this, but there is no "last regenerated" date, no scripted comparison, and no CI check. Add either:

- A scheduled `supabase db diff` job that posts drift to a dashboard, **or**
- A `# Last compared: 2026-05-17` line at the top of `db/schema.sql` plus a `make db:diff` target.

### DB-2 — RLS only declares `FOR SELECT` _(low)_

`supabase/migrations/20260514192711_*.sql:56-58` allows admins to read responses but does not write a deny-by-default for INSERT/UPDATE/DELETE on the `authenticated` role. Service-role server functions bypass RLS so this is fine today, but a future feature that uses an anon-keyed client could insert through a missing-policy hole. Add:

```sql
CREATE POLICY "responses no client writes" ON public.responses
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
```

### DB-3 — No deployment preflight that asserts production env vars _(high)_

`docs/DEPLOYMENT.md:1-46` lists the env vars but doesn't gate the deploy on them. Combined with the Turnstile fail-open behaviour (`audits/07-security.md` S-1 + Codex audit 08), a missed `TURNSTILE_SECRET` in prod silently disables bot defence. Add a `bun run deploy:preflight` script (or a Wrangler `compatibility_date` deploy hook) that asserts:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `TURNSTILE_SECRET` (mandatory in prod)
- `ALLOW_TURNSTILE_BYPASS !== "true"` in prod
- `ADMIN_BOOTSTRAP_EMAIL`
- `VITE_TURNSTILE_SITE_KEY`

### DB-4 — Smoke test only checks SSR; no DB / migration smoke _(medium)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/scripts/smoke-ssr.mjs` probes public + admin routes. Add a parallel `smoke:db` that:

- Runs `supabase db diff` and fails on unexpected drift.
- Probes Supabase Auth `/auth/v1/settings` and asserts "confirm email = true".
- Tests RLS with the anon key — if it can read `responses`, fail.

### DB-5 — No Supabase Auth settings doc _(medium)_

The deployment doc tells you to "Configure Supabase Auth email confirmation and password protection." but does not say _where_ in the dashboard or how to verify. Add a screenshot / step list to `db/README.md` and link it from `docs/DEPLOYMENT.md`.

### DB-6 — No stale-row cleanup _(low)_

In-progress `responses` rows accumulate forever. Add a Supabase Scheduled Function (`pg_cron`) that soft-deletes (`status = 'expired'`) `in_progress` rows older than 30 days.

### DB-7 — Service-role key is reachable from any server module _(low)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/integrations/supabase/client.server.ts:11-19` exports `supabaseAdmin`. Any server-fn module can import it, including future modules whose author may not realise they're hitting service-role. Wrap exports in a typed factory `createAdminClient(reason: string)` that logs the reason for audit traceability.

### DB-8 — No backup / restore runbook _(low)_

For a research dataset, point-in-time recovery is the difference between losing a day of fieldwork and not. Document where Supabase PITR settings live, what retention is set, and the restore steps.

### DB-9 — No documented `compatibility_date` policy _(low)_

`wrangler.jsonc` pins a date; bumping it can change Worker runtime semantics. Add a brief note: "Bump `compatibility_date` only after running the smoke suite locally + on staging."

## Suggested improvements

1. Add a `bun run deploy:preflight` script asserting required prod env.
2. Add a deny-by-default `FOR ALL TO authenticated USING (false)` policy on `responses`.
3. Add a `last-compared` date to `db/schema.sql` + a `make db:diff` target.
4. Extend `scripts/smoke-ssr.mjs` with `smoke:db` (RLS probe + auth-settings probe).
5. Document Supabase Auth dashboard settings with screenshots.
6. Add a `pg_cron` job to expire stale `in_progress` rows.
7. Document Cloudflare Worker `compatibility_date` change policy.
8. Add a backup / restore runbook.
