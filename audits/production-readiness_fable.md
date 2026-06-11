# Production Readiness Audit — survey-spark-3

- **Date:** 2026-06-11
- **Auditor:** Claude (Fable 5), automated audit run from the working tree at commit `e93854d` (+ uncommitted codebook-xlsx changes)
- **Scope:** verification gates (typecheck / lint / test / build), dependency vulnerabilities, security posture, deployment & operations, observability, test coverage shape
- **Verdict:** **READY, with conditions.** The app is in unusually good shape for production — strict CI gates, a hardened security header/CSP layer, server-side-only writes behind Turnstile and rate limiting, and thorough operational docs. Two dependency advisories (one HIGH on `xlsx`, one MODERATE on the TanStack Start server core) and a handful of operational gaps should be addressed before or shortly after the next deploy.

---

## 1. Verification gates (run during this audit)

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript | `bun run typecheck` | ✅ pass |
| Lint | `bun run lint` (eslint, zero warnings policy in CI) | ✅ pass |
| Unit/component tests | `bun run test` (vitest) | ⚠️ 643/644 pass — see F-04 |
| Production build | `bun run build` | ✅ pass (13.9s, server + client bundles emitted) |
| Dependency audit | `bun audit` | ⚠️ 2 high / 2 moderate — see F-01, F-02, F-03 |

The single test failure (`StudyLaneContent › switches study page copy through the shared LanguageToggle`, 5s timeout) **passes in isolation**; it timed out only while the production build was running concurrently on the same machine. It is a flake under CPU contention, not a product bug (F-04).

---

## 2. Findings

### F-01 (HIGH) — `xlsx@0.18.5` carries two HIGH advisories with no npm fix path

`bun audit` flags the direct dependency `xlsx <0.19.3`:

- Prototype Pollution — GHSA-4r6h-8v6p-xvw6
- ReDoS — GHSA-5pgg-2g8v-p4x9

Both advisories concern **parsing** workbooks. This codebase only *writes* XLSX (admin codebook export in [codebook-xlsx.ts](../src/lib/codebook-xlsx.ts), admin-authenticated server functions), so the practical exposure today is low — no untrusted spreadsheet ever reaches `XLSX.read` in production code (the read paths are test-only). But the npm registry build of SheetJS is frozen at 0.18.5; patched builds (≥0.19.3, current 0.20.x) ship only from SheetJS's own CDN (`https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`).

**Recommendation:** pin the patched CDN tarball in `package.json` (`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.x/xlsx-0.20.x.tgz"`) or add a documented audit exception noting the write-only usage. Either way, get `bun audit` back to a clean/explained baseline so future regressions are visible. Note the uncommitted codebook work patches raw OOXML post-write, which further reduces reliance on library internals.

### F-02 (HIGH priority, MODERATE severity) — TanStack Start server core below patched version

Locked `@tanstack/start-server-core@1.167.22` is vulnerable to GHSA-9m65-766c-r333 (inbound server-function request deserialization can invoke a sibling client-referenced server function); patched in **1.167.30**. Unlike F-01 this is squarely in the request path: the app's entire write surface is TanStack server functions.

**Recommendation:** `bun update @tanstack/react-start` (semver range `^1.167.50` already allows it — only the lockfile is behind), rerun the suite, redeploy. This is the one finding I'd treat as a deploy blocker.

### F-03 (LOW) — `brace-expansion` moderate advisory, dev-only

Reached only via eslint / lighthouse / typescript-eslint toolchains; not in the runtime bundle. Clears with a routine `bun update`.

### F-04 (LOW) — Flaky component test under load

`StudyLaneContent.test.tsx:44` times out at the default 5s when the machine is busy (jsdom + userEvent language-toggle round trip). It passed on isolated rerun. On a loaded CI runner this will eventually produce a red build that isn't real.

**Recommendation:** raise the per-test timeout for that spec (or convert the language-toggle assertion to `findBy*` with a longer timeout). Related context: the repo already documents jsdom slowness for byte-heavy tests (memory: cross-realm typed arrays); this is the same environment-cost class.

### F-05 (MEDIUM) — No health endpoint for the Node service

`server-node.mjs` serves static assets + SSR but exposes no `/healthz`. No health route exists under `src/routes/api`. Railway's healthcheck (and any uptime monitor) must hit `/`, which runs full SSR + router work — slow, cache-busting, and it can't distinguish "process up" from "Supabase reachable."

**Recommendation:** add a trivial `/healthz` (200, no SSR) in `server-node.mjs` middleware, and optionally a deeper `/healthz/db` reusing the `smoke:db` check for monitors.

### F-06 (MEDIUM) — Rate limiter silently degrades without Redis

[rate-limit.server.ts](../src/lib/rate-limit.server.ts) falls back to a per-process in-memory bucket when `REDIS_URL` is unset. This is documented in `.env.example` and `docs/DEPLOYMENT.md` (good), but nothing *enforces* it: the production boot guard in [security-headers.server.ts](../src/lib/security-headers.server.ts) validates Turnstile config yet not `REDIS_URL`. A misconfigured multi-replica deploy would weaken rate limits invisibly.

**Recommendation:** extend `assertProductionSecurityConfig` to warn loudly (or fail, behind an opt-out flag à la `TURNSTILE_DISABLED`) when `APP_ENV=production` and `REDIS_URL` is unset.

### F-07 (LOW) — No error/crash reporting backend

[error-capture.ts](../src/lib/error-capture.ts) recovers stacks for the SSR error page, and there are ~25 `console.*` call sites, but nothing ships errors anywhere (no Sentry or similar). For a survey instrument collecting research data, silent client-side failures = silently lost responses.

**Recommendation:** at minimum, an API route that the client error boundary can POST to, logged server-side where Railway retains logs. A full APM is optional at this scale.

### F-08 (LOW) — Minor CSP/header inconsistencies

In [security-headers.server.ts](../src/lib/security-headers.server.ts):

- The same CSP is set as both `Content-Security-Policy` **and** `Content-Security-Policy-Report-Only` with no `report-uri`/`report-to` — the Report-Only copy is dead weight; drop it or point it at a reporting endpoint.
- `X-Frame-Options: DENY` contradicts `frame-ancestors 'self'` (modern browsers honor the stricter CSP directive, but pick one story — `frame-ancestors 'none'` + DENY, or `'self'` + SAMEORIGIN).
- `connect-src 'self' https: wss:` is broad; it could be narrowed to the Supabase project host + `challenges.cloudflare.com`.

None of these are vulnerabilities; the header set is otherwise exemplary (nonce-based `script-src`, HSTS w/ preload, COOP, Permissions-Policy lockdown).

### F-09 (INFO) — Uncommitted work in the tree

`src/lib/codebook-xlsx.ts` + its test are modified but uncommitted (bold-header OOXML patching, `@vitest-environment node` pragma). The changes look complete and the suite passes with them. Commit before deploying so the deployed artifact matches a commit.

### F-10 (INFO) — E2E coverage is thin relative to unit coverage

122 vitest files / 644 tests is excellent, and CI adds smoke-SSR, nightly Lighthouse, axe a11y, deploy preflight, db drift check, and guardrail tests. But Playwright e2e is only 2 specs (`a11y.spec.ts`, `survey-language-toggle.spec.ts`). The highest-value untested-end-to-end flow is the full survey submission path (start → answer → Turnstile bypass → submit → resume token), which is the product's reason to exist.

---

## 3. What's already strong (no action needed)

- **Write-path security:** RLS denies all client writes to `responses` (migration `20260521090000`); all writes go through server functions using the service-role client, gated by Turnstile (`verifyTurnstile` fails closed on network errors when a secret is set) and per-IP token-bucket rate limiting (Redis Lua, atomic).
- **Boot-time invariants:** production refuses to start without `TURNSTILE_SECRET` (unless the explicit, warn-loud `TURNSTILE_DISABLED` kill-switch is set) and rejects `ALLOW_TURNSTILE_BYPASS=true`.
- **Admin surface:** every admin server function asserts the `admin` role server-side via `user_roles` (`assertAdmin` in [admin.shared.server.ts](../src/lib/admin.shared.server.ts)); first-admin bootstrap is pinned to `ADMIN_BOOTSTRAP_EMAIL`.
- **Secrets hygiene:** no `.env` tracked in git; clean client (`VITE_*`) vs server env split; service-role key never reaches the client bundle.
- **CI gates:** PR checks (typecheck, format, lint zero-warnings, static preflight), SSR smoke as a deploy gate, nightly Lighthouse + a11y + live preflight + `smoke:db` + migration drift check, plus i18n/codebook guardrail tests. Bundle budgets enforced via size-limit + custom budget/shape scripts.
- **Ops documentation:** `docs/DEPLOYMENT.md`, `BACKUP_RESTORE.md`, `TROUBLESHOOTING.md`, `RESEARCHER_OPS.md`, `ADMIN_ONBOARDING.md` — including honest documentation of the Redis-fallback and Turnstile-kill-switch risk trade-offs.
- **Runtime:** pinned toolchain (`bun@1.3.14`, Node ≥24.15), frozen-lockfile installs everywhere, reproducible nixpacks build, SSR + static serving via a small auditable `server-node.mjs`.

---

## 4. Recommended order of work

1. **Before next deploy:** F-02 (`bun update @tanstack/react-start` → ≥1.167.30) and F-09 (commit the codebook work).
2. **This week:** F-01 (xlsx patched-tarball pin or documented exception), F-05 (healthz), F-06 (REDIS_URL boot warning).
3. **Opportunistic:** F-04 (test timeout), F-07 (error reporting endpoint), F-08 (CSP tidy), F-10 (one e2e for the submit flow).
