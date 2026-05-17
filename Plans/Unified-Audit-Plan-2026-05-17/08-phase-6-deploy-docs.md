# Phase 6 — Deployment, Docs, Observability

## Goal

A production deploy is gated, scripted, observable, and documented for
both researcher and developer audiences.

## Why now

P0–P5 produced shipping-ready code; now we wrap the operational layer
so the project can run without weekly hand-holding.

## Sources

- `audits/10-other.md` (O-1 to O-16)
- `audits/11-database-deployment.md` (DB-1 to DB-9)
- `audits/12-product-admin-workflows.md` (W-1 to W-11)
- `audits/07-security.md` (S-12)
- `Codex-audits/11-database-deployment-audit.md`,
  `12-product-admin-workflows-audit.md`

## Codex Sessions

### Session 6.1 — Deploy preflight script (S, ~1h)

```text
Goal: bun run deploy:preflight asserts every required prod env exists
and rejects deploy if anything is missing.

Edits:
1. Add scripts/deploy-preflight.mjs that checks:
   - SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY
   - TURNSTILE_SECRET (mandatory in prod)
   - ALLOW_TURNSTILE_BYPASS !== "true"
   - ADMIN_BOOTSTRAP_EMAIL (valid email format)
   - VITE_TURNSTILE_SITE_KEY
   - probes Supabase /auth/v1/settings → confirm-email = true
2. Wire into the deploy workflow.

Commit: "ops: deploy preflight asserts every prod env".
```

### Session 6.2 — Researcher ops runbook (S, ~2h)

```text
Goal: docs/RESEARCHER_OPS.md covers launch → monitor → export → closeout.

Sections:
- Pre-launch QA (every survey type tested EN/SI/TA, sample round-trip).
- Daily monitoring (responses count, dropoff, alerts triage).
- Weekly export (with request-ID + checksum logged).
- Survey closeout (final export, integrity verification, retention,
  IRB/ethics-board reporting if applicable).
- Incident response (Turnstile spike, error rate, abuse).

Commit: "docs(ops): researcher operations runbook".
```

### Session 6.3 — Admin onboarding doc (S, ~1h)

```text
Goal: docs/ADMIN_ONBOARDING.md walks a new admin through first login.

Sections:
- ADMIN_BOOTSTRAP_EMAIL setup (server side).
- First sign-up + email confirmation.
- Adding a second admin (user_roles INSERT).
- Resetting a password.
- Inviting a viewer-only role.
- Where exports land + retention policy.
- "What to do if alerts fire" (links into the alerts panel runbook).

Commit: "docs(admin): onboarding flow".
```

### Session 6.4 — CONTRIBUTING + SECURITY + LICENSE (S, ~1h)

```text
Goal: Three small policy docs.

Edits:
1. CONTRIBUTING.md:
   - Branch naming + commit-message convention.
   - bun run typecheck && lint && test before push.
   - PR review checklist (i18n, a11y, perf budget, security headers).
   - Reference Plans/Unified-Audit-Plan-2026-05-17 + audits/.
2. SECURITY.md:
   - Responsible disclosure address.
   - Threat-model summary (one paragraph).
   - SLA for triage + fix.
3. LICENSE: keep UNLICENSED but add a one-paragraph "all rights reserved"
   header.

Commit: "docs: CONTRIBUTING + SECURITY + LICENSE".
```

### Session 6.5 — Structured logging + Sentry (M, ~3h)

```text
Goal: Server logs are JSON; client errors land in Sentry.

Edits:
1. src/lib/logger.ts: tiny wrapper that JSON-stringifies
   { level, msg, requestId, surveySlug, … }. Use across server fns.
2. Add @sentry/react to the client; init in src/start.client.ts (or
   wherever).
3. Add @sentry/cloudflare on the Worker side; init in src/start.ts.
4. Document the dashboard URL + retention in docs/OBSERVABILITY.md.
5. Add a "no PII in logs" assertion in CI:
   - grep src/lib for `answers`, `contact`, `email` inside log/console
     calls — fail if any.

Commit: "obs: structured logger + Sentry".
```

### Session 6.6 — Cloudflare Analytics Engine events (S, ~1h)

```text
Goal: Track survey_started / survey_answered / survey_completed /
language_toggled with no PII.

Edits:
1. src/lib/analytics.client.ts: thin wrapper around CF AE writeDataPoint.
2. Hook into SurveyRunner stage transitions.
3. Document the schema in docs/OBSERVABILITY.md.

Commit: "obs: respondent journey events".
```

### Session 6.7 — Schema drift policy (S, ~1h)

```text
Goal: db/schema.sql comparison policy that won't rot.

Edits:
1. Add a comment header to db/schema.sql: "Last compared with
   supabase/migrations on <DATE>. Run `bun run db:diff` to update."
2. Add scripts/db-diff.mjs that runs `supabase db diff` and writes the
   delta plus a date stamp.
3. Add to nightly.yml so drift is reported automatically.

Commit: "docs(db): schema drift policy + nightly check".
```

### Session 6.8 — RLS deny-by-default (XS, ~30m)

```text
Goal: An anon-keyed client cannot insert/update/delete responses.

Migration:
  create policy "responses no client writes" on public.responses
    for all to authenticated using (false) with check (false);

Verification:
- bun run smoke:db (added in DB-4) tries an insert via anon key and
  expects 403.

Commit: "security(rls): deny-by-default for responses writes".
```

### Session 6.9 — Backup / restore runbook (S, ~1h)

```text
Goal: docs/BACKUP_RESTORE.md.

Sections:
- Supabase PITR settings + retention.
- Manual export pipeline (dump SQL + storage).
- Restore drill (run quarterly).
- How to redact PII before restore-to-staging.

Commit: "docs(ops): backup + restore runbook".
```

### Session 6.10 — Update DEPLOYMENT.md to reflect the new gates (S, ~1h)

```text
Goal: Single source of deploy truth.

Edits:
- Pre-deploy checklist (runs preflight, smoke, db-diff).
- Post-deploy checklist (Lighthouse, smoke against prod, alerts dashboard).
- Rollback procedure (Wrangler revert + Supabase PITR).
- compatibility_date bump policy.

Commit: "docs(deploy): post-Phase-6 deployment runbook".
```

## Verification (whole phase)

```sh
bun run deploy:preflight       # passes against staging env
bun run smoke && bun run smoke:db
# Sentry dashboard shows zero unhandled errors after a smoke run.
# CF AE shows survey_started events from smoke.
```

## Done criteria

- [ ] 6.1 Deploy preflight script in CI.
- [ ] 6.2 RESEARCHER_OPS.md.
- [ ] 6.3 ADMIN_ONBOARDING.md.
- [ ] 6.4 CONTRIBUTING / SECURITY / LICENSE.
- [ ] 6.5 Structured logger + Sentry.
- [ ] 6.6 CF Analytics Engine events.
- [ ] 6.7 Schema drift policy + nightly check.
- [ ] 6.8 RLS deny-by-default migration.
- [ ] 6.9 Backup / restore runbook.
- [ ] 6.10 DEPLOYMENT.md updated.

## Breaking-change flags

- 6.5 introduces Sentry as a new runtime dep + a new external service
  (data residency to confirm with the human, especially for EU/GDPR
  considerations on respondent IPs).
- 6.6 emits to Cloudflare Analytics Engine; confirm the data plan + cost.
- 6.8 RLS migration must be tested on staging — there is a small risk
  of breaking a server fn that was relying on a missing policy as an
  implicit allow.
