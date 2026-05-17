# Survey Spark 3 Audit Index

Date: 2026-05-17

This folder contains a documentation-only audit package for the Survey Spark 3 app. It covers product content, respondent UX, admin workflows, accessibility, performance, tests, architecture, code quality, security, multilingual support, dependencies, database, and deployment. Historical audit notes in `Plans/` were used as context but were not overwritten.

## Current State

- App shape: TanStack Start, TanStack Router, React 19, Vite, Supabase Auth/Postgres, Cloudflare Workers, Tailwind CSS, Radix UI, Framer Motion, Recharts, Vitest, and Playwright.
- Main public surfaces: `/`, `/s/$slug`, `/r/$token`, `/admin`, `/reset-password`, and `/api/admin/export.csv`.
- Data model: anonymous survey responses stored in Supabase `responses`, admin roles in `user_roles`, service-role server functions for respondent writes, authenticated admin paths for analytics and exports.
- Existing local audit history lives in `Plans/post-audit-plan.md`, `Plans/AuditV2-fixes.md`, and `Plans/Turnstile-Integration.md`.
- Implementation re-check found an unrelated untracked `audits/` folder. This audit package intentionally uses `Codex-audits/` and does not touch that folder.

## Verification Baseline

| Command | Result |
| --- | --- |
| `git status --short` | At implementation time: `?? audits/` was already present and unrelated. `Codex-audits/` is new from this task. |
| `./node_modules/.bin/tsc --noEmit` | Passes with exit code 0. |
| `./node_modules/.bin/eslint .` | Fails with `1949` problems: `1927` errors and `22` warnings. Top rules: `prettier/prettier` `1865`, `no-restricted-syntax` `52`, `react-refresh/only-export-components` `12`. |
| `./node_modules/.bin/vitest run` | Blocked before tests run by Rollup native optional dependency/macOS code-signing failure. |
| `./node_modules/.bin/vite build` | Blocked by the same Rollup native optional dependency/macOS code-signing failure. |
| `./node_modules/.bin/playwright test` | Blocked because Playwright config starts `bun run dev`, and this shell reports `bun: command not found`. |
| `pnpm outdated --format list` | Completed with slow registry warnings. Upgrade candidates include TanStack Router/Start, Vite, ESLint, TypeScript, Recharts, Zod, lucide-react, and others. |
| `pnpm audit --prod` | Cannot run: `ERR_PNPM_AUDIT_NO_LOCKFILE`, because there is no `pnpm-lock.yaml`; repo uses `bun.lock`. |

Current blocker strings to preserve in follow-up work:

- `bun: command not found`
- Rollup native optional dependency/code-signing failure blocks Vite/Vitest
- Playwright webServer cannot start because it runs `bun run dev`
- `pnpm audit` cannot audit without `pnpm-lock.yaml`

## Highest Priority Findings

1. Tooling is not reproducible in this environment: Bun is missing, Rollup native loading is blocked, and package-manager audit commands do not match the committed lockfile.
2. Lint is far from green: most failures are formatting, but the inline Sinhala/Tamil guardrail violations are real architecture/i18n debt.
3. Security posture is improved from earlier audits, but Turnstile currently fails open when `TURNSTILE_SECRET` is missing, and admin login rate limiting needs a design review.
4. `src/routes/admin.tsx` is still very large at about `4099` lines, with adjacent large server/helper modules that raise maintenance risk.
5. CI guardrails are narrow. The repo has targeted GitHub Actions jobs, but no broad lint/typecheck/build/full-test safety net documented as required.
6. Runtime performance cannot be fully verified until Vite/Vitest/Playwright run locally again.

## Audit Files

- [01 Content Audit](01-content-audit.md)
- [02 UI/UX Audit](02-ui-ux-audit.md)
- [03 Accessibility Audit](03-accessibility-audit.md)
- [04 Performance Audit](04-performance-audit.md)
- [05 Testing Audit](05-testing-audit.md)
- [06 Architecture Audit](06-architecture-audit.md)
- [07 Code Quality Audit](07-code-quality-audit.md)
- [08 Security And Privacy Audit](08-security-privacy-audit.md)
- [09 Multilanguage And I18n Audit](09-multilanguage-i18n-audit.md)
- [10 Tech Stack And Dependencies Audit](10-tech-stack-dependencies-audit.md)
- [11 Database And Deployment Audit](11-database-deployment-audit.md)
- [12 Product And Admin Workflows Audit](12-product-admin-workflows-audit.md)
- [Master Todo](MASTER_TODO.md)

## Suggested Execution Order

Use [MASTER_TODO.md](MASTER_TODO.md) as the source of truth for implementation. The short version is:

1. Restore tooling and command reproducibility.
2. Make lint/format/i18n guardrails pass.
3. Resolve security/privacy decisions.
4. Rebuild reliable tests and CI.
5. Split large modules and clean code quality debt.
6. Verify UX, accessibility, and multilingual behavior in a real browser.
7. Measure performance and update deployment/database docs.

## Related Files

- `package.json`
- `eslint.config.js`
- `vite.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `.github/workflows/guardrails.yml`
- `.github/workflows/csv-export-shape.yml`
- `Plans/post-audit-plan.md`
- `Plans/AuditV2-fixes.md`
- `Plans/Turnstile-Integration.md`
