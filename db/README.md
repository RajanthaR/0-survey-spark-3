# Database schema

Portable PostgreSQL schema for the EIP survey app. Single file, no vendor lock-in.

## Apply it

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Requires Postgres 14+ with the `pgcrypto` extension (created automatically).

## What's in it

- `app_role` enum (`admin`, `viewer`)
- `user_roles` table — maps a user UUID to one or more roles
- `responses` table — one row per questionnaire response
  - `survey_slug` — `phase-1` or `phase-3`
  - `resume_token` — random unique token used to resume an in-progress response
  - `language` — `en` / `si` / `ta`
  - `status` — `in_progress` / `completed` / `abandoned`
  - `consent` (jsonb) — checkbox map of consent items the respondent agreed to
  - `answers` (jsonb) — keyed by question id (e.g. `p1_q1_sector`)
  - `contact` (jsonb) — primary / alternate contact block
  - `progress_pct`, `started_at`, `updated_at`, `completed_at`, `user_agent`
- `has_role(uuid, app_role)` — security-definer helper used by RLS
- `touch_updated_at()` trigger — bumps `updated_at` on every update
- Indexes on `survey_slug`, `status`, `started_at`, `resume_token`
- RLS enabled with deny-by-default. Sample admin policies are commented out.

## Schema source of truth

`db/schema.sql` is a portable, hand-maintained snapshot for non-managed deployments.
The **live** RLS policies, triggers, and any future changes live in
`supabase/migrations/` and should be applied through the Supabase CLI or your deployment pipeline. If the two
drift, the migrations win. To regenerate this file from the live database run
`supabase db diff --schema public > db/schema.sql` against a project linked to
the same Supabase instance.

The top of `db/schema.sql` includes the last comparison date. Run
`bun run db:diff` after changing migrations to write a timestamped drift report
under `test-results/db-diff/`. CI runs `bun run db:diff:check` against staging
from the nightly workflow when staging Supabase credentials are configured.

## Wiring it to a backend later

- **Supabase / any Postgres with `auth.uid()`** — uncomment the two `CREATE POLICY` blocks at the bottom of `schema.sql`. Inserts / updates from anonymous respondents go through a server function (e.g. PostgREST RPC, edge function, your own API) that holds a service-role connection and validates the `resume_token`.
- **Custom Node/Go/Python backend** — keep RLS off the client and let your API layer enforce auth. The schema works as-is; the `has_role` helper is still useful for admin checks inside SQL queries.

## Auth settings

The app expects Supabase Auth to enforce email verification before sign-in. In
the Supabase dashboard, confirm:

- **Confirm email:** ON (`auto_confirm_email: false`). Users must click the
  link in their inbox before they can sign in. Do not flip back to auto-confirm.
- **Leaked password protection (HIBP):** ON. Blocks signups/password changes
  whose password appears in the Have I Been Pwned breach corpus.
- **Anonymous sign-ins:** OFF.

`bun run deploy:preflight` and `bun run smoke:db` verify email confirmation by
probing `/auth/v1/settings` and requiring `autoconfirm` or
`mailer_autoconfirm` to be `false`.

`db/schema.sql` is a _reference_ snapshot of the portable schema. The live
RLS policies, indexes, and any post-launch alterations are owned by the
Supabase migrations under `supabase/migrations/`. Consult those migrations as
the source of truth; regenerate this file with `supabase db diff` if needed.

## Exporting responses

```sql
COPY (
  SELECT id, survey_slug, language, status, progress_pct,
         started_at, completed_at, answers, contact
  FROM public.responses
  WHERE survey_slug = 'phase-1'
) TO STDOUT WITH CSV HEADER;
```
