# Deferred breaking changes

These items are **explicitly out of scope** for the unified plan. Each
has a note on what would trigger reassessment.

## Why a "deferred" list

A breaking change is anything that:

1. Forces a major version bump on a runtime dep (Vite, ESLint, TS,
   Vitest, Tailwind).
2. Changes a documented API surface (route URL, server-fn name, public
   env var).
3. Touches the database in a way that requires a coordinated migration
   on production data.
4. Changes the deploy target (e.g. CF Pages → Workers, Workers →
   Vercel).

Doing these too early multiplies the surface a phase has to verify. The
plan is to land the safe wins first, then revisit this list as a
dedicated mini-project once the suite is green and gated.

## Catalogue

### D-1 — Major dependency upgrades

| Package | Current | Latest line | Reason to upgrade | Reason to defer |
| --- | --- | --- | --- | --- |
| `vite` | 7.3 | **8.x** | New build features, smaller cold-start | Cloudflare plugin compat, Rollup 5 surface |
| `eslint` | 9.32 | **10.x** | New flat-config defaults | typescript-eslint, eslint-plugin-react-hooks need re-pinning |
| `typescript` | 5.8 | **6.x** | Faster, stricter | Possibly forces tightening on legacy `as any` first (P3 covers most) |
| `vitest` | 4.1 (pre-rc) | wait for **4 stable** | Faster startup, better Workers compat | We are on a pre-release line; downgrading to `3.x` is the safer move (see St-2). |
| `tailwindcss` | 4.2 | 4.x latest | Bug fixes | Major was the v3→v4 jump; stay on 4.x patches. |
| `recharts` | 2.15 | **3.x** | New API | API rewrite; admin charts would need a rewrite too. |
| `zod` | 3.24 | **4.x** | Better inference | Schemas in use would need migration. |
| `@supabase/supabase-js` | 2.105 | (still 2.x) | Stay on minor | No 3.x line yet. |
| `@tanstack/react-router` | 1.168.25 | **align with start@1.169** | Pin to one minor | See St-1 — non-breaking pin landing in P0. |

**Trigger to revisit:**
- Vitest 4 ships stable.
- Vite 8 ships and Cloudflare plugin updates.
- A CVE forces an upgrade.

### D-2 — Resume token UX change

`Plans/Unified-Audit-Plan-2026-05-17/04-phase-2-security.md` Session 2.2
changes the contract: copying the URL while in-progress no longer also
copies the resume token. Existing respondents who shared a URL will lose
that path.

**Mitigation:**
- Land behind a feature flag.
- Email researcher contact list before flipping.
- Provide a migration window (URL still resumes for 7 days after the
  flip, but new sessions never put the token in the URL).

**Trigger to revisit:** the feature-flag rollout date, agreed with the
research owner.

### D-3 — Database schema changes that require dual-write

The `survey_stats` SQL view in P4.5 is **not** a breaking change (it's
additive). But:

- Renaming the `responses` table → `survey_responses`. Skip.
- Adding a `respondent_uuid` column. Skip until we know we need it.
- Splitting `answers` JSONB into per-question rows. Skip; current shape
  works.

**Trigger to revisit:** response volume > 250 K rows, or analytics
demands a denormalised shape.

### D-4 — Move from Supabase to Postgres-direct

`db/schema.sql` is portable, so this is _possible_ but not _planned_.
Defer until a concrete reason exists.

### D-5 — Deploy target change

Cloudflare Workers + Vite plugin works. Don't change to Pages or to
Vercel without a forcing reason.

### D-6 — Tailwind v4 → v5

When (and if) Tailwind v5 ships, the plugin chain rewrite + the inline
`<style>` CSP story changes. Defer until the v4 LTS window closes.

### D-7 — `xlsx` → `exceljs` migration

`audits/09-tech-stack.md` St-4 flags this. Migration is straightforward
but mechanical and full of test fixture changes.

**Trigger to revisit:** a CVE on `xlsx`, or memory pressure on the
Worker during a real production export.

### D-8 — `@tanstack/react-query` removal

`audits/09-tech-stack.md` St-5 flags this. Drop only if we confirm zero
references after the P3 split.

**Trigger to revisit:** P3 finishes and we run `knip --reporter=json`.

### D-9 — Section-completion view rewrite

`Plans/AuditV2-fixes.md` item #17 was partially landed via the SQL
aggregation in P4. A full rewrite using SQL `generate_series` is
possible but doesn't move a metric.

### D-10 — `routeTree.gen.ts` checked-in policy

We could use `tsr generate --watch` and exclude the file from VCS. This
forces every contributor to run the generator. Today it's checked in.
Defer changing the policy.

### D-11 — Tightening CSP `style-src` (P2.5 partial)

Tailwind v4 inline styles + Google Fonts CSS still need
`'unsafe-inline'` for now. A nonce per inline style is feasible but
brittle.

**Trigger to revisit:** Tailwind v4 ships nonce support, or we move to
extracted CSS only.

### D-12 — Service worker scope change

`public/sw.js` caches hashed `/assets/`. Moving to a precache + Workbox
strategy would let us prefetch survey content for offline. Out of scope.

### D-13 — Replace `framer-motion` with `motion` (the reborn package)

`framer-motion@12` is current. The library has rebranded; future
releases ship as `motion`. Wait for the rename to land in the Lucide
ecosystem before swapping.

## How to add to this list

When a session in any phase doc encounters a change that fits one of the
criteria above, add a row to D-N with:

- The proposing phase + session.
- The reason it's deferred.
- The trigger that would make it eligible.

Do **not** delete entries; mark `RESOLVED` with the date and PR link
when one ships.
