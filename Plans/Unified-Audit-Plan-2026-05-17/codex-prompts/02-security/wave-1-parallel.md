# P2 Wave-1 — 5 parallel prompts

Fire each `## Prompt N.M` section as a **separate** Codex agent.

**Depends on:** P1 fully merged (1.2 in particular adds the `peek` helper
that 2.4 reuses).
**Blocks:** `2.3-headers.md` blocks until 2.1 lands.
            `2.5-csp-nonce.md` blocks until 2.3 lands.

Conflict matrix:

| Prompt | Owns | Touches |
| --- | --- | --- |
| 2.1 | Turnstile prod policy | `src/start.ts`, `src/lib/turnstile.server.ts`, `docs/DEPLOYMENT.md` |
| 2.2 | Resume token URL | `SurveyRunner.tsx`, `ResumeStrip.tsx`, `r.$token.tsx` |
| 2.4 | Durable Object rate limit | `src/lib/rate-limit.{server,do}.ts`, `wrangler.jsonc` |
| 2.6 | supabaseAdmin factory | `src/integrations/supabase/client.server.ts` + every server-fn import |
| 2.7 | Stale-row cron | new Supabase migration only |

2.1 conflicts with **only** 2.3/2.5 (later in the chain), not with the
other wave-1 prompts. All 5 can run concurrently.

---

## Prompt 2.1 — Production Turnstile fail-closed

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR.

**Goal:** Refuse to boot in `NODE_ENV=production` if `TURNSTILE_SECRET` is
missing or `ALLOW_TURNSTILE_BYPASS=true`. Keep the dev fail-open path
with a louder warning.

**Audit ref:** `audits/07-security.md` S-1.

### TODO

1. Read first:
   - `src/lib/turnstile.server.ts` (whole file)
   - `src/start.ts` (top of the file + any boot/env-validation hooks)
   - `docs/DEPLOYMENT.md`
2. Add at the top of `src/start.ts` (before any request handler is
   registered):
   ```ts
   if (process.env.NODE_ENV === "production") {
     if (!process.env.TURNSTILE_SECRET) {
       throw new Error("TURNSTILE_SECRET required in production");
     }
     if (process.env.ALLOW_TURNSTILE_BYPASS === "true") {
       throw new Error("ALLOW_TURNSTILE_BYPASS must not be true in production");
     }
   }
   ```
3. In `src/lib/turnstile.server.ts`, change the dev fail-open log to a
   distinct warning:
   `console.warn("[turnstile] dev fail-open: install TURNSTILE_SECRET to exercise the real flow");`
4. Update `docs/DEPLOYMENT.md` to document the new boot contract.
5. Add a test that the start-up assert fires:
   `src/lib/__tests__/turnstile.boot-policy.test.ts` running the env
   guard in isolation.

### Verification

```bash
bun run test src/lib/__tests__/turnstile
bun run typecheck
NODE_ENV=production unset TURNSTILE_SECRET; bun run dev 2>&1 | grep "required in production"
```

### Commit & PR

- Branch: `security/turnstile-prod-fail-closed`
- Commit: `security(turnstile): fail closed in production [2.1]`
- PR body refs `audits/07-security.md` S-1.

---

## Prompt 2.2 — Resume token out of the URL bar

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Behaviour change — flagged below.

**Goal:** After arriving via `/r/$token`, the URL bar no longer shows
the token. The token is persisted to `localStorage`; ResumeStrip reads
from there.

**Audit ref:** `audits/02-uiux.md` U-3.

⚠ **BEHAVIOUR CHANGE** — copying the URL while in-progress no longer
embeds the resume token. The user must use the "Get my link" button.
The PR body must state this explicitly. If the human pushes back during
review, defer per `09-deferred-breaking.md` D-2.

### TODO

1. Read first:
   - `src/components/SurveyRunner.tsx` (focus on lines 162-243 around
     the `navigate({ search: { token } })` pattern)
   - `src/components/survey/ResumeStrip.tsx`
   - `src/lib/responses.functions.ts` — `resumeResponse`
   - `src/routes/r.$token.tsx`
2. On first arrival via `/r/$token`:
   - Persist the token under `localStorage["resume:" + slug]` with a
     24-hour sliding TTL (write a tiny `setWithTTL` / `getWithTTL`
     helper if none exists).
   - Immediately call `history.replaceState(null, "", "/s/" + slug)`
     so the URL no longer contains the token.
3. `ResumeStrip`:
   - Read from `localStorage`, not from `window.location`.
   - On "Get my link" click, regenerate the share URL from the stored
     token.
4. Add a test in `src/components/__tests__/SurveyRunner.resumeTokenUrl.test.tsx`
   asserting that after mount, `window.location.pathname` does not
   contain the token and `window.location.search` is empty.

### Verification

```bash
bun run test src/components/__tests__/SurveyRunner.resumeTokenUrl.test.tsx
bun run test src/components/__tests__/SurveyRunner   # nothing regresses
bun run typecheck
# Manual smoke (or Computer Use):
bun run dev
open "http://localhost:5173/r/<seed-token>"
# URL bar should be "/s/<slug>" within ~100ms; copy-link still works.
```

### Commit & PR

- Branch: `security/resume-token-out-of-url`
- Commit: `security(resume): keep token out of the URL bar [2.2]`
- PR body refs `audits/02-uiux.md` U-3 and explicitly states the
  behaviour change.

### Stop conditions

- If `r.$token.tsx` route depends on the token in the URL for SSR data
  loading, STOP and report — this prompt needs an extra design step.

---

## Prompt 2.4 — Durable Object rate limiter

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. New DO + wrangler binding + refactor.

**Goal:** Move rate-limit state into a Cloudflare Durable Object so
isolate restarts cannot reset attacker counters.

**Audit ref:** `audits/07-security.md` S-3.

⚠ **INFRA CHANGE** — adds a Durable Object binding. Confirm CF plan
allows DO; document the ~1ms latency budget in the PR body.

### TODO

1. Read first:
   - `src/lib/rate-limit.server.ts` (includes the `peek` helper added
     in 1.2)
   - `wrangler.jsonc`
   - `src/integrations/supabase/client.server.ts` (for the env binding
     pattern)
2. Create `src/lib/rate-limit.do.ts`:
   ```ts
   export class RateLimitDO {
     state: DurableObjectState;
     // Token-bucket per `key`, persisted between requests in
     // this.state.storage.
     async fetch(req: Request): Promise<Response> { /* peek | consume */ }
   }
   ```
   The class exposes `peek(key, cfg)` and `consume(key, cfg)` via the
   request body protocol.
3. Update `wrangler.jsonc`:
   ```jsonc
   "durable_objects": {
     "bindings": [{ "name": "RATE_LIMIT", "class_name": "RateLimitDO" }]
   },
   "migrations": [{ "tag": "v1", "new_classes": ["RateLimitDO"] }]
   ```
4. Refactor `src/lib/rate-limit.server.ts`:
   - In production (binding exists): forward to the DO via
     `env.RATE_LIMIT.idFromName(key)` + `.fetch(...)`.
   - In dev/test (no binding): fall back to the existing in-memory Map.
   - `peek` and `consume` both proxy to the active backend.
5. Update existing tests; add a DO-path test using the
   `@cloudflare/workers-types` `unstable_dev` harness if available, OR
   leave the DO path as a manual smoke item (note in PR body).

### Verification

```bash
bun run test src/lib/__tests__/rate-limit*
bun run typecheck
bun run build                   # wrangler must accept the new binding
```

### Commit & PR

- Branch: `security/durable-rate-limit`
- Commit: `security(rate-limit): durable bucket via Cloudflare Durable Object [2.4]`
- PR body refs `audits/07-security.md` S-3, lists the new binding,
  and records the expected latency budget.

### Stop conditions

- If `wrangler` rejects the binding because of plan limits, STOP and
  ask the human; defer to `09-deferred-breaking.md`.
- If the existing in-memory bucket is *also* used outside admin login
  (e.g. by Turnstile), update the same call sites — but stay within the
  same PR.

---

## Prompt 2.6 — Audit-logged supabaseAdmin factory

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Replaces `supabaseAdmin` exports — large diff but
       mechanical.

**Goal:** Replace the always-on `supabaseAdmin` export with a typed
factory `createAdminClient(reason: string)`. Add a CI grep that fails
the build if a client (`*.tsx`, browser) imports the admin client.

**Audit ref:** `audits/11-database-deployment.md` DB-7.

### TODO

1. Read first:
   - `src/integrations/supabase/client.server.ts`
   - `grep -rn "supabaseAdmin" src/ --include="*.ts" --include="*.tsx"`
2. Refactor `client.server.ts`:
   ```ts
   const seen = new Set<string>();
   export function createAdminClient(reason: string) {
     if (!seen.has(reason)) {
       seen.add(reason);
       console.log(JSON.stringify({
         kind: "audit.supabaseAdmin",
         reason,
         ts: new Date().toISOString(),
       }));
     }
     return createClient(/* ... service role ... */);
   }
   ```
   Remove the bare `supabaseAdmin` export.
3. Update every call site found in step 1 to pass a `reason` string
   (e.g. `"responses.startResponse"`,
   `"admin.stats.getOverviewStats"`).
4. Add a CI grep in `pr.yml` (new step in the lint job):
   ```bash
   if grep -RIn "supabaseAdmin\\|createAdminClient" src --include="*.tsx" \\
        | grep -v "/__tests__/"; then
     echo "client file imports admin client" >&2
     exit 1
   fi
   ```
5. Add a test asserting that two calls with the same `reason` log only
   once.

### Verification

```bash
bun run typecheck
bun run lint
bun run test src/integrations/supabase
bash -c 'if grep -RIn "supabaseAdmin\\|createAdminClient" src --include="*.tsx" | grep -v "/__tests__/"; then exit 1; fi'
```

### Commit & PR

- Branch: `security/supabase-admin-factory`
- Commit: `security(supabase): audit-logged service-role client factory [2.6]`
- PR body refs `audits/11-database-deployment.md` DB-7 and lists the
  call sites migrated.

### Stop conditions

- If a single PR diff exceeds 800 lines because there are dozens of
  call sites, split into:
  (a) introduce `createAdminClient` while keeping `supabaseAdmin` as a
      deprecated alias,
  (b) follow-up PR replacing the alias.

---

## Prompt 2.7 — Stale-row cron

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. New migration only.

**Goal:** Mark `responses` rows as `expired` if they are
`in_progress` for more than 30 days.

**Audit refs:** `audits/07-security.md` S-13, `audits/11-database-deployment.md` DB-6.

### TODO

1. Read first:
   - `supabase/migrations/` (latest file numbering)
   - `db/schema.sql` for the `responses.status` enum/constraint
2. Create `supabase/migrations/<timestamp>_expire_stale_responses.sql`:
   ```sql
   create extension if not exists pg_cron;

   create or replace function expire_stale_responses()
     returns void
     language sql
     security definer
     set search_path = public
   as $$
     update public.responses
        set status = 'expired',
            updated_at = now()
      where status = 'in_progress'
        and started_at < now() - interval '30 days';
   $$;

   select cron.schedule(
     'expire-stale-responses',
     '0 3 * * *',
     $$select expire_stale_responses();$$
   );
   ```
3. If `responses.status` is constrained (`CHECK` or enum) and does not
   include `'expired'`, add an `ALTER TABLE` / `ALTER TYPE` in the same
   migration.
4. Add a quick test under `supabase/tests/` (if pgTAP-style tests
   exist) OR document a manual smoke in the PR:
   - Seed a row with `started_at = now() - interval '31 days'`.
   - Run `select expire_stale_responses();`.
   - Assert the row is now `'expired'`.

### Verification

```bash
supabase db push --include-all     # locally
# Then run the manual smoke seeded above.
bun run typecheck                  # no app code change, but sanity
```

### Commit & PR

- Branch: `db/expire-stale-responses`
- Commit: `db(retention): expire in_progress responses after 30d [2.7]`
- PR body refs `audits/07-security.md` S-13 and lists the manual smoke
  results.

### Stop conditions

- If `pg_cron` is not available on the Supabase plan in use, STOP and
  ask the human; alternative is a Cloudflare Cron Trigger calling a
  server fn.
- Do not modify `db/schema.sql` directly — the migration is the source
  of truth (audits/11-database-deployment.md DB-1).
