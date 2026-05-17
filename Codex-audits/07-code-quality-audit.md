# Code Quality Audit

## Current State

The app is TypeScript strict, has ESLint plus Prettier integration, and currently type-checks. However, lint is failing heavily because the codebase is not formatted according to configured Prettier rules and because some localization guardrails are violated.

## Findings

- TypeScript passes with `strict: true`.
- ESLint fails with `1949` total problems across `136` files.
- Most lint problems are mechanical Prettier issues: `1865` `prettier/prettier` findings.
- There are `52` `no-restricted-syntax` findings for Sinhala/Tamil outside allowed dictionary/survey/test files.
- Other issues include `react-refresh/only-export-components`, stale eslint-disable comments, `no-explicit-any`, `no-unsafe-function-type`, and one hooks dependency warning.
- Top lint problem files include `SurveyRunner.tsx`, `admin.tsx`, `phase-3.ts`, `phase-1.ts`, generated Supabase types, and large admin/test files.
- `src/integrations/supabase/types.ts` appears generated and should not be hand-formatted unless the generation pipeline supports it.
- Existing code comments are often helpful, but several files are large enough that comments cannot compensate for module size.

## Suggested Improvements

- Run a dedicated formatting-only pass first, but protect generated/vendor-like files if needed.
- Resolve inline localized strings by moving labels into `UI`, survey definitions, or a dedicated approved dictionary module.
- Update ESLint ignores/allowlists intentionally for generated files and true dictionary files instead of letting known exceptions fail repeatedly.
- Remove stale eslint-disable comments after formatter/lint cleanup.
- Fix the `SurveyRunner` hook warning with a code change or a precise justification.
- Reduce `any` casts around Supabase writes with typed insert/update helpers where practical.
- Add `format:check` and `typecheck` scripts so CI can separate mechanical formatting from code correctness.

## Priority

- P0: Format and i18n guardrail cleanup, because current lint is too noisy for safe future work.
- P1: Generated-file lint policy and stale-disable cleanup.
- P1: Hooks warning and `any` cleanup around data boundaries.
- P2: Ongoing module-size refactors after tests are reliable.

## Verification

- ESLint JSON summary: `filesWithProblems: 136`, `totalProblems: 1949`, `totalErrors: 1927`, `totalWarnings: 22`.
- Top rules: `prettier/prettier` `1865`, `no-restricted-syntax` `52`, `react-refresh/only-export-components` `12`.
- `./node_modules/.bin/tsc --noEmit` passes.

## Related Files

- `eslint.config.js`
- `.prettierrc`
- `.prettierignore`
- `src/components/SurveyRunner.tsx`
- `src/routes/admin.tsx`
- `src/lib/analytics-report-i18n.ts`
- `src/components/survey/ResponseVisualSummary.tsx`
- `src/integrations/supabase/types.ts`
- `src/surveys/phase-1.ts`
- `src/surveys/phase-3.ts`
