# Railway Migration Plan

Step-by-step plan to port `survey-spark-3` from Cloudflare Workers to Railway
(Node.js). No code changes have been made yet; this document is the proposal.

## Scope

Replace the Cloudflare Workers runtime with a Node.js server on Railway while
preserving SSR, security headers, Supabase integration, Turnstile verification,
and the existing rate-limit semantics. Keep all CI workflows runnable; keep
the Supabase database, Auth settings, and migrations untouched.

Out of scope: code changes to surveys, admin analytics, exports, or schemas.

## Architecture Today

- Build target: Cloudflare Workers, via `@cloudflare/vite-plugin` injected at
  build time in `vite.config.ts`.
- Worker manifest: `wrangler.jsonc` declares a Durable Object binding
  `RATE_LIMIT` mapped to the `RateLimitDO` class re-exported from
  `src/server.ts`.
- Server entry: `src/server.ts` exports a Web-Fetch-style
  `export default { fetch }` Worker handler that wraps
  `@tanstack/react-start/server-entry` with branded SSR error normalisation.
- Cloudflare-specific runtime lookups exist in
  `src/lib/rate-limit.server.ts` and `src/lib/turnstile.server.ts`, both
  reading `cloudflareEnv` off `getGlobalStartContext()`.
- Everything else in `src/` (Supabase client, security headers, admin guards,
  responses, server fns) is runtime-agnostic.

## Architecture On Railway

- Build target: Node.js 24.15.0, Bun 1.3.14 for build tooling, served via
  the TanStack Start `node-server` Nitro preset.
- Process model: a single long-lived Node process listening on
  `process.env.PORT` (Railway injects this).
- State that previously lived in a Durable Object: see "Rate-limit backend"
  below — this is the only real architectural decision.
- Static assets: served by the Node process (Nitro emits a combined
  client + server output under `.output/`).

## Decision Points

Resolve these before starting Phase 1.

### 1. Rate-limit backend

| Option                           | Pros                                                                        | Cons                                                             |
| -------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| In-memory Map (current fallback) | Smallest diff. No infra.                                                    | Resets on deploy or crash. Breaks under multi-replica.           |
| Supabase Postgres bucket table   | Reuses existing infra. Survives restarts. Per-IP atomic via row-level lock. | Adds a write per gated request. Slightly higher latency than DO. |
| Railway Redis add-on             | Lowest latency. Idiomatic INCR/EXPIRE.                                      | New service, new dependency, ~ $5/mo at minimum tier.            |

Recommendation: **Supabase Postgres** if you want production multi-replica
without new infra. **In-memory** if Railway will run a single replica and
brief counter resets across deploys are acceptable.

### 2. Replica count

If you keep the in-memory rate limiter, pin Railway to exactly 1 replica per
service. Otherwise per-IP buckets diverge across replicas and the limiter
becomes ineffective.

### 3. Domain / TLS

Railway issues a `*.up.railway.app` domain by default and supports custom
domains with managed TLS. Decide upfront so Supabase Auth redirect URLs and
Turnstile site key allowlists can be updated atomically with the deploy.

### 4. Bun vs Node at runtime

Build runs under Bun (matches local `package.json` `packageManager`). Runtime
should be Node 24.15.0 because TanStack Start's `node-server` preset and the
Nitro output target Node. Nixpacks will detect both from `engines` in
`package.json`.

## Phase 1 — Strip Cloudflare-specific Build Plumbing

Goal: build still produces a runnable bundle, but no longer targets Workers.
This phase compiles but the server entry is broken until Phase 2 lands.

Files to edit:

- `vite.config.ts`
  - Remove the `import { cloudflare } from "@cloudflare/vite-plugin"` import.
  - Remove the `if (command === "build") plugins.push(cloudflare())` block.
- `package.json`
  - Remove `@cloudflare/vite-plugin` from `dependencies`.
  - Run `bun install` to refresh `bun.lock`.

Files to delete:

- `wrangler.jsonc`
- `.wrangler/` (gitignored already, but remove from disk)

No tests are expected to fail in Phase 1 because the deleted code paths are
build-time only. `bun run typecheck` and `bun run test` should still pass.
`bun run build` will still run; the resulting output shape changes.

## Phase 2 — Switch TanStack Start Target And Server Entry

Goal: emit a Node server that can be `node`-launched.

### 2.1 Configure the Nitro preset

In `vite.config.ts` update:

```ts
tanstackStart({ server: { entry: "server", preset: "node-server" } });
```

Verify the option name against the installed `@tanstack/react-start` version.
If the API differs, the same effect is achievable via `NITRO_PRESET=node-server`
at build time. The preset emits `.output/server/index.mjs` and a
`.output/public/` directory with hashed client assets.

### 2.2 Rewrite `src/server.ts`

The current file has two responsibilities: the SSR error wrapper and the
Worker handler. Keep the first, drop the second.

Required changes:

- Remove `export { RateLimitDO } from "./lib/rate-limit.do";`.
- Remove the `cloudflareEnv` / `cloudflareContext` fields from the SSR
  context object — Nitro provides `event.context` natively.
- Replace `export default { async fetch(request, env, ctx) { ... } }` with a
  Nitro event handler (or keep the Web-Fetch shape and let Nitro adapt it; the
  `node-server` preset accepts both). Preserve:
  - `assertProductionSecurityConfig({ ...process.env })`
  - `consumeLastCapturedError()` integration
  - `normalizeCatastrophicSsrResponse(request, response)`
  - `brandedErrorResponse(request)` fallback
  - The `[SSR] ${requestLabel} -> ${status} in ${ms}ms` log line for >=500.
- The current handler's `env` parameter becomes `process.env`. Every reader
  (security headers, Turnstile, rate limiter) already falls back to
  `process.env`.

### 2.3 Drop Durable Object code

Files to delete:

- `src/lib/rate-limit.do.ts`

Files to edit:

- `src/lib/rate-limit.server.ts`
  - Drop `DurableObjectId`, `DurableObjectStub`, `DurableObjectNamespace`,
    `StartContextWithCloudflare`, `getRateLimitNamespace`,
    `proxyToDurableObject` types and helpers.
  - In `rateLimit()` and `peekRateLimit()`, remove the `await proxyToDurableObject(...)`
    short-circuit. The remaining in-memory Map path becomes the only path
    until Phase 3 picks a backend.
  - Keep the `__resetRateLimitForTests` hook.
- `src/lib/turnstile.server.ts`
  - Drop `StartContextWithEnv` and the `getGlobalStartContext` lookup in
    `envString()`. Read `process.env[key]` directly.

### 2.4 Verification gate

```bash
bun run typecheck
bun run lint -- --max-warnings 0
bun run format:check
bun run test
bun run build
bun run preview -- --host 127.0.0.1 --port 4173 &
BASE_URL=http://127.0.0.1:4173 bun run smoke
```

The smoke step exercises `/`, `/s/phase-1`, `/s/phase-3`, `/r/smoke-test-token`,
and `/admin` and asserts the security-header contract. This is the same gate
that runs in `.github/workflows/smoke.yml`.

## Phase 3 — Rate-limit Backend

Pick exactly one path based on the decision in "Decision Points #1".

### 3a. Keep in-memory (no further code)

Document in `docs/DEPLOYMENT.md` and Railway service settings that the service
must run with `replicas = 1`. Add a note to the post-deploy checklist that
counters reset on deploy.

### 3b. Supabase Postgres bucket

New migration in `supabase/migrations/<timestamp>_rate_limit_buckets.sql`:

- Table `public.rate_limit_buckets` with columns
  `id text primary key`, `tokens double precision not null`,
  `updated_at timestamptz not null default now()`.
- Row-level security: deny all anon access. Service role only.
- Function `public.consume_rate_limit(p_id text, p_capacity int, p_window_ms int)`
  returning `(tokens double precision, retry_sec int, allowed boolean)` that
  performs the token-bucket math atomically inside an UPDATE returning clause.

In `src/lib/rate-limit.server.ts`:

- Add a `proxyToSupabase(op, key, cfg)` helper that calls the function via
  the service-role Supabase client from `src/integrations/supabase/client.server.ts`.
- The in-memory Map fallback stays as the test/local path
  (gated on `process.env.NODE_ENV !== "production"` or absence of service-role
  env, so vitest stays hermetic).

Add tests under `src/lib/__tests__/rate-limit.supabase.test.ts` that mock the
service-role client and assert the consume / peek payload shape.

### 3c. Railway Redis

Provision a Redis add-on in the Railway project. Inject `REDIS_URL` into the
service env. Add a `redis` client dependency (e.g. `ioredis`).

In `src/lib/rate-limit.server.ts`:

- Add a `proxyToRedis(op, key, cfg)` helper using the standard
  Redis token-bucket script (Lua `EVAL` for atomicity).
- Keep the in-memory fallback for test/local.

Add `REDIS_URL` to `.env.example`, `docs/DEPLOYMENT.md`, and the Railway
service config.

## Phase 4 — Railway Service Configuration

### 4.1 Build and start commands

In `package.json` add:

```jsonc
{
  "scripts": {
    "start": "node .output/server/index.mjs",
  },
}
```

Confirm `bun run build` produces `.output/server/index.mjs`. If the Nitro
preset emits a different filename, update the script accordingly.

### 4.2 Nixpacks / Procfile

Option A — let Nixpacks autodetect: it will use `bun install`, `bun run build`,
and `bun run start` from `package.json`. Node 24 is selected from `engines.node`.

Option B — pin explicitly. Create `nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["bun", "nodejs_24"]

[phases.build]
cmds = ["bun install --frozen-lockfile", "bun run build"]

[start]
cmd = "node .output/server/index.mjs"
```

Pick Option B if Railway picks the wrong Node version on autodetect.

### 4.3 Service environment variables

Set in the Railway service (Settings → Variables):

Server-only:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`
- `TURNSTILE_SECRET`
- `ALLOW_TURNSTILE_BYPASS=false`
- `APP_ENV=production` (or `staging`)
- `NODE_ENV=production`

Build-time (Vite inlines these at build):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_TURNSTILE_SITE_KEY`

If Phase 3b: nothing extra.
If Phase 3c: `REDIS_URL`.

Railway injects `PORT`. Confirm the Node entry binds to it. With Nitro's
`node-server` preset this is automatic.

### 4.4 Replicas, regions, healthcheck

- Replicas: 1 if Phase 3a, otherwise free to scale.
- Region: pick one close to the Supabase region (e.g. `us-east` if Supabase
  is `us-east-1`) to keep server-fn round-trips low.
- Healthcheck: HTTP GET `/` expecting 200. The SSR smoke list confirms this
  route is always 2xx without auth.

### 4.5 Domain and Auth

- Add the Railway domain (or custom domain) to Supabase Auth → URL
  Configuration → Site URL and Redirect URLs.
- Add the same domain to the Turnstile site key allowlist in the Cloudflare
  dashboard.
- Update `.env` `BASE_URL` if used in scripts.

## Phase 5 — CI, Docs, And Cleanup

### 5.1 GitHub Actions

The five workflows in `.github/workflows/` are runtime-agnostic and continue
to work. Audit `nightly.yml` for any Cloudflare-specific assumptions; the
`STAGING_BASE_URL` variable just needs to point at the Railway staging URL.

`smoke.yml` already smokes against `bun run preview` on `127.0.0.1:4173`,
which is unchanged.

### 5.2 Docs to update

- `README.md` — replace the Cloudflare Workers bullet and the Deployment
  section with a Railway-specific equivalent.
- `docs/DEPLOYMENT.md` — replace the "Deploy" and "Rollback" sections.
  Wrangler-specific guidance becomes Railway-specific (deploy via Git push
  or `railway up`, rollback via Railway's deployment history).
- `audits/00-overview.md` and `Plans/Unified-Audit-Plan-2026-05-17/` — leave
  as historical, do not rewrite. Add a short note at the top of the audit
  overview pointing to this document for the post-Cloudflare runbook.
- `SECURITY.md` — update any Cloudflare-specific incident references.

### 5.3 Files to delete

- `wrangler.jsonc`
- `.wrangler/`
- `src/lib/rate-limit.do.ts`

### 5.4 Files to add (depending on choices)

- `nixpacks.toml` (only if Phase 4.2 Option B chosen)
- `supabase/migrations/<timestamp>_rate_limit_buckets.sql` (only if Phase 3b)
- `docs/RAILWAY-MIGRATION.md` (this file)

## Verification

Run after each phase, and as the final gate before the cutover deploy.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint -- --max-warnings 0
bun run format:check
bun run test
bun run build
bun run deploy:preflight:static
bun run preview -- --host 127.0.0.1 --port 4173 &
BASE_URL=http://127.0.0.1:4173 bun run smoke
SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... bun run smoke:db
```

Live deploy-gate (requires staging Supabase / Turnstile):

```bash
bun run deploy:preflight
bun run db:diff:check
```

Once the Railway staging service is live, run `BASE_URL=<staging-url> bun run smoke`
to confirm the deployed runtime, headers, and CSP nonce flow.

## Rollback Strategy

Cutover risks:

- SSR breaks with a different error envelope on Node than on Workers.
  Mitigation: `normalizeCatastrophicSsrResponse` already brands h3 errors;
  re-run the SSR smoke against the staging deploy before flipping DNS.
- Rate-limit window resets on first deploy if going from DO → in-memory or
  Postgres. Mitigation: deploy during a low-traffic window.
- CSP nonce mismatch on Node if the response stream is re-buffered. Mitigation:
  the smoke script asserts `script-src 'nonce-...'` and rejects `'unsafe-inline'`.

Rollback path:

1. Keep the previous Cloudflare Worker deploy live until the Railway smoke
   passes against production traffic for at least one full hour.
2. If a regression is detected, revert DNS to Cloudflare and re-run smoke.
3. Preserve the Railway deployment ID, Worker version ID, and timestamps in
   the incident record.

## Effort Estimate

- Phase 1 + Phase 2: ~3–4 hours including local smoke and typecheck.
- Phase 3a (in-memory): trivial.
- Phase 3b (Supabase): ~4–6 hours for migration, function, tests.
- Phase 3c (Redis): ~3–4 hours for client, Lua script, tests.
- Phase 4 (Railway config): ~1 hour.
- Phase 5 (docs, cleanup): ~1 hour.

Total, conservative: half a day for in-memory; one full day for Supabase or
Redis-backed limiter.

## Open Questions

- Does the installed `@tanstack/react-start@1.167.x` accept
  `tanstackStart({ server: { preset: "node-server" } })`? Verify against the
  package's exported types before Phase 2.1.
- Will Railway run build under Bun by default given `packageManager` is set
  to `bun@1.3.14`? Confirm in a throwaway service before committing
  `nixpacks.toml`.
- Is the `RATE_LIMIT` Durable Object the only Cloudflare-specific runtime
  binding? Audit `getGlobalStartContext()` callers one more time before
  deleting `cloudflareEnv` plumbing.
