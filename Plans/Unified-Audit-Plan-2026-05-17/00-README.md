# Unified Audit Implementation Plan — 2026-05-17

This package merges two parallel audits of `survey-spark-3`:

- `audits/` — my audit set (12 topical files + master TODO + supplement).
- `Codex-audits/` — Codex's audit set (12 topical files + master TODO).

The two audits agree on the broad strokes and differ in detail. The supplement
at `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/audits/13-codex-parity-supplement.md` records the items Codex caught that I missed
(notably the `adminLoginGuard` bug + the existing CSP `'unsafe-inline'`) and
fixes errors in my earlier write-up.

## What this folder contains

| File | Purpose |
| --- | --- |
| `00-README.md` | This file. Read first. |
| `01-codex-gpt55-playbook.md` | How to drive this plan from Codex Desktop with GPT-5.5. |
| `02-phase-0-tooling.md` | Phase 0 — restore tooling reproducibility (Bun, Rollup, lockfile, CI baseline). |
| `03-phase-1-bugfixes.md` | Phase 1 — turn the test suite green, fix real bugs. |
| `04-phase-2-security.md` | Phase 2 — security & privacy hardening. |
| `05-phase-3-architecture.md` | Phase 3 — split monoliths, extract hooks, type the data layer. |
| `06-phase-4-perf.md` | Phase 4 — performance budgets, durable rate limit, font deferral. |
| `07-phase-5-ux-a11y-i18n.md` | Phase 5 — UX/a11y/i18n polish, error-page localisation. |
| `08-phase-6-deploy-docs.md` | Phase 6 — deployment preflight, docs, observability. |
| `09-deferred-breaking.md` | Explicitly deferred breaking changes, with re-evaluation triggers. |
| `10-master-todo.md` | Single ordered checklist for execution. |

## Methodology

Each phase doc follows the same shape so Codex can pick it up unchanged:

- **Goal** — what done looks like.
- **Why now** — preconditions + what unlocks.
- **Codex sessions** — long-horizon prompts sized for one GPT-5.5 run.
- **Verification** — exact commands to confirm done.
- **Done criteria** — checklist Codex can tick.
- **Sources** — links to my audits + Codex-audits + relevant files.

## Phase ordering rationale

```
P0 → P1 → P2 → P3 → P4 → P5 → P6
```

- **P0 (tooling)** unblocks everything. Without `bun run test` working, no other phase can be verified.
- **P1 (bug fixes)** turns the suite green so subsequent refactors don't ride on red. Includes the `adminLoginGuard` real bug because it's small + critical.
- **P2 (security)** lands while the codebase is still small enough for atomic edits, before architectural splits scatter security touch-points.
- **P3 (architecture)** is the largest diff but produces no behaviour change. Done after P0–P2 so test gates catch regressions.
- **P4 (performance)** measures against the post-split bundles.
- **P5 (UX/a11y/i18n)** depends on a green test suite + split admin route to avoid huge merge conflicts.
- **P6 (deploy + docs)** captures everything that landed in production-ready form.

## Breaking changes

Anything labelled **🔴 BREAKING / DEFER** in any phase is _not_ in the
implementation plan. See `09-deferred-breaking.md` for the catalogue and
the conditions that would trigger reassessment (e.g. "Vitest 4 ships stable",
"Vite 8 stabilises", "Supabase RLS DSL migrates").

## Quick start — for the human

1. Open `01-codex-gpt55-playbook.md` and read the "Codex Desktop session model".
2. Skim `10-master-todo.md` for the phased checklist.
3. Drive Codex one phase at a time:
   - Open the relevant phase doc.
   - Copy the **first** Codex Session prompt into the Codex Desktop chat.
   - Let GPT-5.5 run until the verification commands pass.
   - Tick the Done items in `10-master-todo.md`.
   - Move to the next session.

## Health snapshot (post-merge)

| Area | Was | Now (after this plan) |
| --- | --- | --- |
| Tests | 51 failing | 0 failing, gated in CI |
| Lint | 1 949 problems | 0 errors, ≤10 explicit warnings |
| Security | 4 open issues (`adminLoginGuard` broken, Turnstile fail-open, no HSTS, no admin lockout) | All closed; CSP nonces; Durable Object rate limit |
| Architecture | `admin.tsx` 4 099 lines, `SurveyRunner.tsx` 877 lines | Per-feature routes ≤500 lines each; hooks extracted |
| Performance | Unmeasured | Lighthouse budget green on /, /s/$slug; admin chunk lazy |
| Docs | README + `Plans/` only | README + DEPLOYMENT + RESEARCHER_OPS + ADMIN_ONBOARDING + TROUBLESHOOTING + SECURITY + CONTRIBUTING |
