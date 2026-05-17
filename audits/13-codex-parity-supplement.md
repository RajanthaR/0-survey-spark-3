# Audit 13 — Codex Parity Supplement

(Added 2026-05-17 after diffing my audits against `Codex-audits/`.)

This document records findings I missed in `00`–`10` that the Codex package
caught, plus updates where my own findings need correcting against the actual
codebase. Treat it as an _addendum_ to the prior audits — it does not replace
them.

## New findings

### S-15 — `adminLoginGuard` lockout semantics are broken _(real bug, high)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin-login-guard.functions.ts:1-44` claims to enforce a per-(email + IP) "5 fails / 15 min" lockout, but the implementation uses **two independent buckets** that never read each other:

```@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin-login-guard.functions.ts:20-43
    if (data.outcome === "check") {
      // Throws 429 if already exhausted; consumes 0 tokens otherwise.
      // We use a peek pattern by calling rateLimit then refunding via
      // a second bucket name is overkill; instead we rely on the same
      // bucket for both phases — `check` is a no-op pass-through, and
      // `fail` is the consumption call. Lock-out is enforced on the
      // NEXT `check` after 5 prior failures.
      rateLimit(`peek:${key}`, {
        name: "adminLoginPeek",
        capacity: 5,
        windowMs: 15 * 60 * 1000,
      });
      // Mirror state from the real bucket (fail bucket) by inspecting nothing —
      // simply return ok. The check-phase bucket above protects against
      // probing storms (5 checks / 15 min per email+ip).
      return { ok: true };
    }
    // outcome === "fail" — consume a fail token.
    rateLimit(key, {
      name: "adminLoginFail",
      capacity: 5,
      windowMs: 15 * 60 * 1000,
    });
```

What the comment promises ("Lock-out is enforced on the NEXT `check` after 5 prior failures") never happens. The `check` path consumes a token from `peek:${key}` (rule `adminLoginPeek`); the `fail` path consumes a token from `${key}` (rule `adminLoginFail`). Neither bucket reads the other. Result: an attacker can keep trying logins; the only consequence after 5 failures is that the **6th `fail` report** throws — which they can simply skip from a non-cooperating client.

Even worse: the failure-reporting call is made by the client _after_ Supabase returns an auth error (see `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/admin.tsx` for the call site). A scripted attacker just doesn't call `adminLoginGuard` at all and is throttled only by Supabase's own rate limit.

**Fix sketch:**
- Combine both phases into a single bucket. `check` peeks (returns the token count without decrementing), `fail` decrements.
- Since `rate-limit.server.ts` doesn't expose a peek, add a `peek(key, cfg)` helper that returns `{ tokens, retrySec }` without mutating state, then have `check` throw 429 when `tokens === 0`.
- Move the call to a Supabase Auth `before_user_signed_in` hook (or middleware on the server-fn that wraps the auth call) so a malicious client cannot skip it.

### S-16 — CSP currently allows `'unsafe-inline'` on script + style _(medium)_

I claimed in `audits/07-security.md` that there were "no CSP / HSTS / Permissions-Policy headers". That's **wrong** — `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:81-117` ships a Content-Security-Policy via `<meta http-equiv>` covering `default-src`, `script-src`, `style-src`, `frame-src`, `connect-src`, `img-src`, `font-src`, `worker-src`, `manifest-src`. The remaining gap is the `'unsafe-inline'` allow on both `script-src` and `script-src-elem` (required by the pre-hydration `<script>` and TanStack Start's runtime `<Scripts />` injection) and `style-src` (Tailwind runtime + Google Fonts).

**Fix sketch:**
1. Replace the inline pre-hydration `<script>` with a server-rendered `<html lang>` driven by a cookie/hint header so the inline script becomes unnecessary (`audits/02-uiux.md` U-2 / `audits/08-i18n.md` I-4).
2. Adopt a per-request CSP nonce on TanStack Start's `<Scripts />` once it supports nonces, and drop `'unsafe-inline'` from `script-src-elem`.
3. Tailwind v4 inline `<style>` tags can use `'unsafe-hashes' 'sha256-…'` once you enumerate them, dropping `'unsafe-inline'` from `style-src`.
4. Add `Strict-Transport-Security`, `Permissions-Policy`, and `Referrer-Policy` via request middleware (these are still missing).

### S-17 — `pickText` already warns in dev when SI/TA falls back to EN _(strength I missed)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/i18n.tsx` warns in dev when a non-English translation is missing. This is great. The follow-up I missed: pipe those warnings into a CI step (e.g. test mode) that fails when any UI render path falls back. That converts a friendly dev hint into an enforced contract.

### S-18 — Same-as-English dictionary entries need a translator review report _(i18n)_

Codex's `09-multilanguage-i18n-audit.md` raises a useful tooling addition I missed: a "same-as-English review report" that lists every `LocalizedString` whose `si` or `ta` value equals the `en` value. Some are intentional (units like "kg", brand names like "EIP Insight"); others are leaks the translator hasn't reviewed. Add a Vitest report that prints this list grouped by file.

### S-19 — Tooling reproducibility gaps that block CI from existing _(blocker)_

Codex documents that in their environment, `bun: command not found`, Rollup native loading is blocked by macOS code-signing, `pnpm audit` cannot run without `pnpm-lock.yaml`. In my own session I had to use Node from `~/.nvm/versions/node/v24.14.1/bin/node ./node_modules/eslint/bin/eslint.js` because the Bun-shaped `.bin/eslint` shim wouldn't execute. None of this is documented for new contributors. Add `docs/TROUBLESHOOTING.md` covering:

- `bun: command not found` → install Bun or use `npx --no` against the binary scripts inside `node_modules/<pkg>/bin/*.js`.
- Rollup `@rollup/rollup-darwin-arm64` native binary code-signing failure → run `npm rebuild` or remove the optional dep.
- `pnpm audit --prod` failure → no `pnpm-lock.yaml`; choose one PM and stick to it (see `audits/09-tech-stack.md` St-6).
- The general "use Node from `~/.nvm/versions/node/v24.x/bin` directly" workaround.

### S-20 — Generated files don't have explicit lint policy _(low)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/integrations/supabase/types.ts` is generated by Supabase but lints anyway. Add an ESLint override that skips Prettier + `@typescript-eslint/*` on generated files, **and** add `.gitattributes`:

```
src/integrations/supabase/types.ts linguist-generated=true
src/routeTree.gen.ts linguist-generated=true
```

### S-21 — Test data strategy for large-dataset exports is missing _(medium)_

Codex flags this. Right now there is no fixture for "50 000 responses across 3 surveys × 3 languages" and the streaming export code paths are only e2e-tested at small scale. Add `src/test/fixtures/large-dataset.ts` with deterministic seed data and a Vitest spec that exercises:

- CSV streaming chunked writes
- ZIP bundle progress + recovery
- XLSX worksheet generation under memory pressure
- CRC32 + SHA256 manifest verification

## Corrections to my earlier audits

| File | Where I was wrong | Correction |
| --- | --- | --- |
| `audits/07-security.md` S-6 | Said "no CSP / HSTS / Permissions-Policy / Referrer-Policy headers". | CSP **is** present via `<meta http-equiv>` (see S-16 above). HSTS / Permissions-Policy / Referrer-Policy are still missing. |
| `audits/04-testing.md` (test totals) | Said "test files: 79". | Counted on disk: 81 source `__tests__` files + 1 top-level `e2e/` spec. Codex's 79 may be a slightly different glob. Both are fine to round to "~80". |
| `audits/09-tech-stack.md` (Node) | Implied Node was missing. | Node 24.14.1 _is_ installed under `~/.nvm/versions/node/v24.14.1/bin`. The PATH ordering hides it; `bun` is what's actually missing. |

## Net effect on the master TODO

These items merge into the unified plan as:

- **P0 (bug fixes):** S-15 admin guard fix.
- **P1 (security hardening):** S-16 CSP nonces, S-19 tooling docs.
- **P2 (DX / polish):** S-17 fallback-warning CI integration, S-18 same-as-English report, S-20 generated-file lint policy, S-21 large-dataset fixtures.

See `Plans/Unified-Audit-Plan-2026-05-17/10-master-todo.md` for the integrated execution order.
