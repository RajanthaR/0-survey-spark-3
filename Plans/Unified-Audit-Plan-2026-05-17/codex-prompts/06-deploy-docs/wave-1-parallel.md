# P6 Wave-1 — 10 parallel prompts

Fire each `## Prompt N.M` section as a **separate** Codex agent. P6 is
entirely independent of itself — every prompt touches a different
file. All 10 can run concurrently if you have agents to spare.

**Depends on:** P5 fully merged (the manual a11y sweep doc exists).

| Prompt | Owns |
| --- | --- |
| 6.1 | deploy preflight script |
| 6.2 | researcher ops guide |
| 6.3 | admin onboarding |
| 6.4 | CONTRIBUTING/SECURITY/LICENSE |
| 6.5 | structured logging |
| 6.6 | analytics events doc + emitter |
| 6.7 | schema drift CI gate |
| 6.8 | RLS deny-by-default migration |
| 6.9 | Supabase backup runbook |
| 6.10 | docs/DEPLOYMENT.md refresh |

---

## Prompt 6.1 — `scripts/deploy-preflight.mjs`

ROLE: Senior engineer. Execute immediately. One PR.
**Audit ref:** `audits/11-database-deployment.md` DB-2.

### TODO
1. New `scripts/deploy-preflight.mjs` that:
   - Asserts each of `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`, `WORKER_BASE_URL` is present.
   - Asserts `NODE_ENV` is `production`.
   - Asserts `ALLOW_TURNSTILE_BYPASS` is unset or `false`.
   - Exits 1 with a list of all missing/invalid vars on failure.
2. `package.json` script: `"preflight": "node scripts/deploy-preflight.mjs"`.
3. `docs/DEPLOYMENT.md`: add a "Run preflight" step before `wrangler deploy`.

### Verification
```bash
unset TURNSTILE_SECRET; bun run preflight && exit 1 || echo OK
```

### Commit & PR
- Branch: `ops/deploy-preflight`
- Commit: `ops(deploy): preflight script for required envs [6.1]`

---

## Prompt 6.2 — `docs/RESEARCHER-OPS.md`

ROLE: Senior engineer. Execute immediately. One PR. Docs only.
**Audit ref:** `audits/12-product-admin-workflows.md` W-7.

### TODO
1. Create `docs/RESEARCHER-OPS.md` covering:
   - How to publish a new survey (`src/surveys/<slug>.ts`, what to fill, EN/SI/TA contract).
   - How to invite a respondent (resume link copy/paste).
   - Triage flagged responses (where the flag UI lives in admin).
   - Pull an export.
   - Apologies-and-resend pattern.
2. Link from `README.md` "For researchers".

### Verification
```bash
test -f docs/RESEARCHER-OPS.md
grep -q "RESEARCHER-OPS" README.md
```

### Commit & PR
- Branch: `docs/researcher-ops`
- Commit: `docs: researcher operations guide [6.2]`

---

## Prompt 6.3 — `docs/ADMIN-ONBOARDING.md`

ROLE: Senior engineer. Execute immediately. One PR. Docs only.
**Audit ref:** `audits/12-product-admin-workflows.md` W-6.

### TODO
1. Create `docs/ADMIN-ONBOARDING.md`:
   - How `ADMIN_BOOTSTRAP_EMAIL` works (first-time setup).
   - Adding a new admin (manual SQL today; document the row shape).
   - Demoting an admin.
   - Recovery if all admins lock out (15-min wait; see audit S-15).
2. Cross-link from `docs/DEPLOYMENT.md`.

### Commit & PR
- Branch: `docs/admin-onboarding`
- Commit: `docs: admin onboarding + recovery [6.3]`

---

## Prompt 6.4 — `CONTRIBUTING.md` + `SECURITY.md` + `LICENSE`

ROLE: Senior engineer. Execute immediately. One PR. Docs only.
**Audit ref:** `audits/10-other.md` O-3 / O-4 / O-5.

### TODO
1. `CONTRIBUTING.md`: branch naming, commit prefix table (feat/fix/perf/refactor/docs/test/security/i18n/db/ops/chore), test discipline ("tests are contracts, no skip/delete"), local dev flow, link `Plans/Unified-Audit-Plan-2026-05-17/`.
2. `SECURITY.md`: how to report a vulnerability (email + PGP optional), supported versions, expected response time.
3. `LICENSE`: confirm with user before committing; if uncertain, write `LICENSE` as a placeholder `Proprietary — All Rights Reserved` and note in PR body.

### Verification
```bash
ls CONTRIBUTING.md SECURITY.md LICENSE
```

### Commit & PR
- Branch: `docs/contributing-security-license`
- Commit: `docs: contributing + security + license [6.4]`

### Stop conditions
- If the user has not confirmed a license, leave a placeholder and flag in PR body.

---

## Prompt 6.5 — Structured logging

ROLE: Senior engineer. Execute immediately. One PR.
**Audit ref:** `audits/10-other.md` O-7.

### TODO
1. New `src/lib/log.server.ts`:
   ```ts
   export function log(event: string, fields: Record<string, unknown>) {
     console.log(JSON.stringify({ event, ts: Date.now(), ...fields }));
   }
   ```
2. Replace `console.log` / `console.error` in:
   - `src/lib/responses.functions.ts`
   - `src/lib/admin.stats.functions.ts`
   - `src/lib/turnstile.server.ts`
   - `src/lib/rate-limit.server.ts`
   - `src/integrations/supabase/client.server.ts` (the audit-log from 2.6 already uses JSON — leave it)
3. Do NOT log PII (no answer values, no email).

### Verification
```bash
bun run typecheck && bun run test
grep -rn "console.log\\|console.error" src/lib/*.functions.ts src/lib/*.server.ts | wc -l
# Should drop substantially.
```

### Commit & PR
- Branch: `ops/structured-logging`
- Commit: `ops(log): structured JSON logging on server paths [6.5]`

---

## Prompt 6.6 — Analytics events doc + minimal emitter

ROLE: Senior engineer. Execute immediately. One PR.
**Audit ref:** `audits/10-other.md` O-8.

### TODO
1. `docs/ANALYTICS.md`: list every product event we want (survey_start, survey_complete, survey_abandon, lang_change, admin_login, export_run) with fields, retention policy, and PII rules.
2. Implement a tiny emitter in `src/lib/analytics.ts` that:
   - In dev: console.debug.
   - In prod: posts to `process.env.ANALYTICS_ENDPOINT` if set, else no-op.
   - Bears the structured-log shape from 6.5.
3. Wire 1-2 events as proof (e.g. `survey_start` on first answer, `lang_change` on toggle).
4. Test: emit asserts payload shape.

### Verification
```bash
bun run test src/lib/__tests__/analytics.test.ts
```

### Commit & PR
- Branch: `analytics/events-skeleton`
- Commit: `analytics: events doc + minimal emitter [6.6]`

---

## Prompt 6.7 — Schema drift CI gate

ROLE: Senior engineer. Execute immediately. One PR. CI only.
**Audit ref:** `audits/11-database-deployment.md` DB-1.

### TODO
1. New `.github/workflows/schema-drift.yml`:
   - On `pull_request` paths `db/**` or `supabase/migrations/**`.
   - Boots a Supabase local stack, applies migrations, runs `supabase db diff` against `db/schema.sql`.
   - Fails if diff non-empty (drift detected).
2. Add a note to `docs/ARCHITECTURE.md` "Generated files" section about `db/schema.sql` being a snapshot.

### Verification
```bash
bunx --bun yaml-lint .github/workflows/schema-drift.yml
```

### Commit & PR
- Branch: `ci/schema-drift`
- Commit: `ci(db): fail on schema.sql vs migrations drift [6.7]`

### Stop conditions
- If running Supabase locally in CI is impractical (resource limits), fall back to `bun run schema:check` that asserts `db/schema.sql` mtime ≥ last migration mtime, and document the limitation.

---

## Prompt 6.8 — RLS deny-by-default migration

ROLE: Senior engineer. Execute immediately. One PR.
**Audit refs:** `audits/07-security.md` S-9, `audits/11-database-deployment.md` DB-3.

⚠ **HIGH RISK**: a wrong policy locks the app out. Requires user review before merge.

### TODO
1. New migration `supabase/migrations/<ts>_rls_deny_by_default.sql`:
   - For each public table (`responses`, `consent`, `admins`, etc.):
     - `revoke all on <table> from anon, authenticated`
     - explicit `grant ...` for only the columns/rows the app needs.
   - Wrap policy adds in `if not exists` where supported.
2. Add a test file `supabase/tests/rls-respondent.spec.sql` (or pgTAP test) covering: anon can insert into `responses` with required fields, but cannot read other respondents' rows.
3. Smoke locally: respondent flow still works end-to-end.

### Verification
```bash
supabase db push --include-all
supabase test db   # if pgTAP set up
bun run dev
# Manual: complete a survey end-to-end; check admin can still read.
```

### Commit & PR
- Branch: `security/rls-deny-by-default`
- Commit: `security(rls): deny-by-default + explicit grants [6.8]`
- PR body explicitly flags HIGH RISK and lists every grant.

### Stop conditions
- If existing migrations already use deny-by-default, downgrade to a no-op + audit doc.
- Any smoke failure → revert and STOP.

---

## Prompt 6.9 — `docs/BACKUP.md` runbook

ROLE: Senior engineer. Execute immediately. One PR. Docs only.
**Audit refs:** `audits/11-database-deployment.md` DB-5, `audits/13-codex-parity-supplement.md` S-9.

### TODO
1. `docs/BACKUP.md` covering:
   - Snapshot cadence (assume Supabase managed daily by default; document how to verify in dashboard).
   - Off-site replica strategy (recommend `pg_dump` cron in a separate Cloudflare Worker or a GitHub Action that pushes encrypted dumps to R2).
   - Restore drill: full schema + sample-data restore against a `restored_<date>` schema, document the expected duration.
   - Quarterly drill checklist (table to copy when scheduled).
2. Cross-link from `docs/DEPLOYMENT.md` and `docs/ARCHITECTURE.md`.

### Commit & PR
- Branch: `docs/backup-runbook`
- Commit: `docs(ops): backup + restore runbook [6.9]`

---

## Prompt 6.10 — `docs/DEPLOYMENT.md` refresh

ROLE: Senior engineer. Execute immediately. One PR. Docs only.
**Audit refs:** `audits/09-tech-stack.md` TS-3, `audits/11-database-deployment.md` DB-2.

### TODO
1. Read current `docs/DEPLOYMENT.md`.
2. Rewrite to reflect the merged state after P0-P6:
   - Required env vars (cross-link 6.1).
   - Preflight step.
   - `wrangler deploy` command + expected output.
   - Rollback procedure (Cloudflare worker version pinning).
   - Post-deploy smoke: hit `/` 200, hit `/admin` 401, hit security headers (cross-link 2.3).
   - Where to monitor logs (Cloudflare dashboard).
3. Link `RESEARCHER-OPS.md`, `ADMIN-ONBOARDING.md`, `BACKUP.md`, `SECURITY.md`.

### Verification
```bash
bunx --bun markdownlint-cli docs/DEPLOYMENT.md
```

### Commit & PR
- Branch: `docs/deployment-refresh`
- Commit: `docs(deploy): refresh post-audit deployment guide [6.10]`

---

## Wave gate

After all 10 PRs merge, P6 (and the unified plan) is complete. The
release candidate satisfies every Blocker + Serious finding from
`audits/00-overview.md` and `Codex-audits/`. Final checklist:

- [ ] All audits' Blocker findings closed in the master TODO
- [ ] All deferred items still listed in `09-deferred-breaking.md`
- [ ] Screenshot tree updated in `screenshots/post-p6/`
- [ ] Tag release candidate `v2026.05-audit-pass-1`
