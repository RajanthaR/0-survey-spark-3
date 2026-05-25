# Repository Guidance

## Tooling

- Use Bun as the package manager. `bun.lock` is the source of truth; do not add `pnpm-lock.yaml`.
- Expected local runtimes are Bun `1.3.14` and Node.js `24.15.0`. `.nvmrc` and `.tool-versions` document the pins.
- Prefer the project scripts:
  - `bun run typecheck`
  - `bun run lint -- --max-warnings 0`
  - `bun run format:check`
  - `bun run test`
  - `bun run build`
  - `bun run start` (Node runtime equivalent of the Railway service: boots `server-node.mjs` against `dist/`)
  - `bun run deploy:preflight:static`
  - `bun run deploy:preflight`
  - `bun run smoke:db`
  - `bun run db:diff`
  - `bun run db:diff:check`
  - `bun run size`
  - `bun run bundle:shape`
  - `bun run test:a11y`
  - `bun run lighthouse:ci`
- If `bun` is not on `PATH` (fresh Codex shell), prepend `~/.bun/bin` first, e.g. `export PATH="$HOME/.bun/bin:$PATH"`. If Bun is missing entirely, install with `curl -fsSL https://bun.sh/install | bash`; the installer pins itself into `~/.zshrc`.
- If the Codex app bundled Node rejects Rollup's native package on macOS (`ERR_DLOPEN_FAILED` / invalid code signature on `@rollup/rollup-darwin-*`), run build/test commands with the local NVM Node first on `PATH`, e.g. `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$HOME/.bun/bin:$PATH"`. Bun and NVM Node should both be ahead of the bundled Node. If `v24.15.0` is not installed locally, use the closest installed NVM Node 24.x and note it in verification.
- On Windows, Node `24.15.0` is available via Scoop (`scoop install nodejs-lts`); prepend `$env:USERPROFILE\scoop\apps\nodejs-lts\current` to `$env:Path` before running build/test or Node-served smoke commands. Verify with `node --version` before running `node server-node.mjs`.

## Formatting And Generated Files

- Audit artifacts under `audits/`, `Codex-audits/`, `Plans/`, and `debug/` are intentionally excluded from formatter churn.
- Generated files such as `src/routeTree.gen.ts` and `src/integrations/supabase/types.ts` are ignored by ESLint/Prettier policy unless the generator itself changes.
- `lint-staged` (husky pre-commit) prettier-checks `*.{ts,tsx,js,mjs,cjs,json,md,css,html,yml,yaml}` and ESLints `*.{ts,tsx}`. Editing workflow YAML triggers prettier on commit.

## CI Topology

Five workflows under `.github/workflows/`:

- `pr.yml` — runs on PR + push: main. Parallel jobs include `static` (typecheck + format + lint + `bun run deploy:preflight:static` + service-role grep), `test` (vitest), and `build` (vite). The build job uploads `dist`; dependent `bundle` and `a11y` jobs download that artifact to run `bun run size`, `bun run bundle:shape`, and unauthenticated axe scans for `/`, `/s/phase-1`, and `/admin`. Fan-out is for wall-clock; do not collapse jobs back together without measuring.
- `nightly.yml` — runs on schedule and manual dispatch. It validates `vars.STAGING_BASE_URL` plus staging Supabase/Turnstile deploy-gate inputs, then runs Lighthouse thresholds, axe scans on the same critical routes, `bun run deploy:preflight`, `bun run smoke:db`, `bun run db:diff:check`, and `bun audit --audit-level=moderate`. Keep `STAGING_BASE_URL`, `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY`, `STAGING_ADMIN_BOOTSTRAP_EMAIL`, and `STAGING_TURNSTILE_SITE_KEY` as GitHub Actions repository variables. Keep `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_TURNSTILE_SECRET`, and either `STAGING_SUPABASE_DB_URL` or `STAGING_SUPABASE_ACCESS_TOKEN` as secrets.
- `smoke.yml` — runs on push: main only. Builds, starts the preview server, runs `scripts/smoke-ssr.mjs` against the 5 canonical routes. **This is a deploy gate**: a smoke failure on main MUST be reverted before any further pushes. Do not move it onto PRs without a deliberate compute-vs-feedback decision.
- `guardrails.yml` — strict subset of `pr.yml`'s `bun run test`. Runs on PR only. Keep intact.
- `csv-export-shape.yml` — strict subset of `pr.yml`'s `bun run test`. Runs on PR only. Keep intact.

All workflows declare `concurrency: cancel-in-progress: true` on `${{ github.workflow }}-${{ github.ref }}` and share a `paths-ignore` block for `audits/`, `Codex-audits/`, `Plans/`, `docs/`, `**/*.md`, `LICENSE`, `.gitignore`, `.gitattributes`, `.editorconfig`. Keep that block in sync across all workflows when editing.

## Runtime And Deployment

- The app deploys to Railway as a Node.js service. Cloudflare Workers, Wrangler, `wrangler.jsonc`, `@cloudflare/vite-plugin`, and Durable Objects are no longer in the runtime path. Do not reintroduce them without an explicit migration decision.
- Build chain: Bun installs and `vite build` emits `dist/server/server.js` (Web-Fetch SSR handler) plus `dist/client/*` (hashed static assets). `server-node.mjs` at the repo root is the Node entry that uses `srvx` + `srvx/static` to serve `dist/client/*` and delegate everything else to `dist/server/server.js`'s `fetch(request)`.
- Railway picks up `nixpacks.toml`: `bun install --frozen-lockfile` → `bun run build` → `node server-node.mjs`. Bump pinned versions only in a dedicated PR.
- Rate limiting lives in Redis when `REDIS_URL` is set (token-bucket implemented as a Lua `defineCommand` script in `src/lib/rate-limit.server.ts`). When Redis is unset or transiently unreachable the limiter falls back to a per-process in-memory `Map` and logs `[rate-limit] Redis call failed; falling back to in-memory:` once per failure. The fallback is safe for local/test but breaks across replicas in production — keep `REDIS_URL` set on Railway and keep replica counts honest about that constraint.
- Required runtime env on Railway: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_BOOTSTRAP_EMAIL`, `TURNSTILE_SECRET`, `ALLOW_TURNSTILE_BYPASS=false`, `REDIS_URL`, `APP_ENV` and `NODE_ENV` set to `production` (or `staging`). Required at build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_TURNSTILE_SITE_KEY`. Railway injects `PORT`; the Node entry honours `HOSTNAME` (default `0.0.0.0`).
- Migration history and a phase-by-phase runbook live in `docs/RAILWAY-MIGRATION.md`. The active deployment runbook is `docs/DEPLOYMENT.md`.
- Turnstile can be temporarily bypassed for non-production QA using the tracked Windsurf workflow `.windsurf/workflows/bypass-turnstile.md` (`/bypass-turnstile`). Never enable `ALLOW_TURNSTILE_BYPASS=true` for production.

## Server Boundaries

- TanStack Start route modules are client-imported. Do not statically import `*.server.*` modules from files that can enter the client graph.
- Put testable server-only implementations in `*.impl.server.ts` or `*.shared.server.ts`, and import them inside `createServerFn().handler(...)`.
- Keep client-facing files limited to RPC wrappers, types, schemas, and browser-safe code.
- Avoid module-level mutable diagnostics in shared client/server modules. If a helper such as `pickText` needs test-only miss accounting, gate it to `import.meta.env.MODE === "test"` and skip SSR/production accumulation so requests never share growing global arrays or counters.
- `src/server.ts` exports a pure Web-Fetch handler (`export default { async fetch(request: Request) }`). Do not reintroduce a Worker `(request, env, ctx)` signature or thread `cloudflareEnv` / `cloudflareContext` through the H3 request context. `process.env` is the single source of runtime config for `assertProductionSecurityConfig`, `verifyTurnstile`, and the rate limiter.
- The Redis client in `src/lib/rate-limit.server.ts` is lazily constructed on first call and gated on `REDIS_URL`. Keep the in-memory `Map` path intact so vitest can run without Redis. The public API (`rateLimit`, `peekRateLimit`, `getClientIp`, `__resetRateLimitForTests`) is consumed by mocks in `responses.bypassRateLimit.test.ts` and `responses.turnstileGuard.test.ts` — preserve those exports.

## Verification Notes

- Run focused tests near the changed behavior, then the strict tooling gate (`bun run typecheck && bun run lint -- --max-warnings 0 && bun run format:check && bun run test && bun run build`).
- Deploy-gate changes should run `bun run deploy:preflight:static` locally. Run live `bun run deploy:preflight`, `bun run smoke:db`, and `bun run db:diff:check` only when staging Supabase/Turnstile env vars are present.
- `bun run deploy:preflight` requires `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`, `VITE_TURNSTILE_SITE_KEY`, and `APP_ENV`/`ENVIRONMENT`/`NODE_ENV` set to `staging` or `production`; it rejects `ALLOW_TURNSTILE_BYPASS=true` and verifies Supabase Auth email confirmation via `/auth/v1/settings`.
- `bun run smoke:db` verifies Supabase Auth email confirmation and expects an anon/publishable-key insert into `public.responses` to fail with 401/403.
- `bun run db:diff` writes timestamped Supabase CLI output under `test-results/db-diff/`; `bun run db:diff:check` fails on reported drift. Provide `SUPABASE_DB_URL` or `SUPABASE_ACCESS_TOKEN` for remote/staging checks.
- Phase 4 performance changes should also run `bun run size` and `bun run bundle:shape` after `bun run build`; both scripts consume fresh `dist/bundle-shape.json`.
- Local axe verification is `bun run build`, start preview on `127.0.0.1:4173`, then `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 bun run test:a11y`. The default axe routes are `/`, `/s/phase-1`, and unauthenticated `/admin`.
- `bunx playwright install chromium` may time out downloading Chromium in this Codex macOS environment. Treat that as a local browser-install blocker if it retries and stalls; CI installs Chromium before running axe.
- Local Lighthouse verification uses `BASE_URL=<url> bun run lighthouse:ci`. CI/nightly uses `vars.STAGING_BASE_URL` and enforces LCP <= 2.5s, TTI <= 3.5s, and CLS <= 0.1.
- Local preview smoke (Vite-served): `bun run build && bun run preview -- --host 127.0.0.1 --port 4173 &` then `BASE_URL=http://127.0.0.1:4173 bun run smoke`. CI runs this same flow in `smoke.yml` only on push: main, so PRs that touch `src/start.ts`, `src/server.ts`, `src/lib/security-headers.server.ts`, `src/routes/__root.tsx`, `server-node.mjs`, or anything else affecting SSR / CSP should be smoked locally before merging.
- Production-equivalent smoke (Node-served, matches Railway): `bun run build && PORT=4173 HOSTNAME=127.0.0.1 node server-node.mjs &` then `BASE_URL=http://127.0.0.1:4173 bun run smoke`. Use this when changing `server-node.mjs`, `src/server.ts`, the rate-limit Redis path, or anything that interacts with the `srvx` static / fetch bridge. Requires NVM Node 24.x on `PATH`; the bundled Codex Node and Bun cannot run the compiled server bundle interchangeably.
- `src/lib/__tests__/codebook-xlsx.test.ts` has shown local Vitest hangs in this environment; treat that as an environment-specific runner issue unless it reproduces in CI. Use `bun run test -- --exclude '**/codebook-xlsx.test.ts'` to bypass when running the full suite locally.
- The survey-runner navigation/focus failures that were present after Phase 4 (clustered in `SurveyRunner.backFocusReturn.a11y.test.tsx`, `SurveyRunner.nextAnnouncements.a11y.test.tsx`, `SurveyRunner.rapidBackAnnouncements.a11y.test.tsx`, `SurveyRunner.telNumRangeGating.e2e.test.tsx`, `SurveyRunner.nextDisabled.e2e.test.tsx`, and one case in `SurveyRunner.saveExitAfterBack.e2e.test.tsx`) were resolved in PR #8 (`fix/survey-navigation-focus`) and PR #9 (`fix/survey-i18n-a11y`). The local full suite excluding `codebook-xlsx.test.ts` is expected to pass as of `main`.
- `src/lib/__tests__/responses.language.test.ts` fails to load locally with `TypeError: undefined is not an object (evaluating 'z.object')` originating in `src/lib/responses.functions.ts`. The failure reproduces on `main` independently of any feature work — treat it as a pre-existing zod / Vitest resolution issue, not a regression of whatever you're shipping.
- `src/lib/__tests__/rate-limit.redis.test.ts` exercises the Redis-backed limiter via a hoisted `vi.mock("ioredis", ...)` factory. The fallback case intentionally logs `[rate-limit] Redis call failed; falling back to in-memory:` to stderr — that is expected test output, not a failure signal.
