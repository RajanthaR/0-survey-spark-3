# Performance Audit

## Current State

The app has a respondent survey path and a heavier admin analytics/export path. Charts are partly lazy-loaded, option-image prefetching and a service worker exist, exports include streaming support, and Cloudflare Workers are the target deployment runtime.

## Findings

- Build and bundle analysis cannot run because Vite fails during Rollup native module loading.
- The respondent path imports Framer Motion in several components, which may be acceptable but should be measured on low-end mobile.
- Admin charts are lazy-loaded via `src/routes/admin/charts-lazy.ts`, but `src/components/ui/chart.tsx`, Recharts, PDF export, XLSX, and admin export helpers still need bundle/runtime measurement.
- `src/routes/admin.tsx` imports `fflate` directly and is very large, increasing the chance of broad admin bundle cost and slower maintenance.
- `public/sw.js`, `registerOptionImageSW`, option-image prefetching, and metrics hooks indicate good intent, but service worker behavior needs browser verification.
- The HTTP streaming CSV endpoint at `/api/admin/export.csv` is a major improvement over full string buffering, but admin UI paths still include multiple export modes that should be profiled with large data.
- `getStats` still limits rows for stats queries, so performance and correctness can diverge as response volume grows.

## Suggested Improvements

- Fix the Rollup/native dependency blocker, then run production build with bundle analysis.
- Measure first load for respondent routes separately from admin route.
- Keep Recharts, PDF generation, XLSX, ZIP, and export-only code out of respondent bundles.
- Add a performance budget: respondent JS size, route load time, image cache hit rate, export memory ceiling, and admin chart render time.
- Verify option-image service worker install/cache/update behavior in Chromium and Safari.
- Add a large-dataset export smoke test for CSV/XLSX/ZIP paths with request ID logging and recovery.
- Consider server-side aggregate views if `getStats` row caps become real.

## Priority

- P0: Restore build so performance can be measured.
- P1: Confirm respondent bundle excludes admin-only code.
- P1: Load-test export and stats paths against realistic dataset size.
- P2: Add performance budgets to CI or release checklist.

## Verification

- `./node_modules/.bin/vite build` fails before building because Rollup native optional dependency loading is blocked by macOS code signing.
- `./node_modules/.bin/vitest run` fails for the same Rollup dependency reason.
- Source review confirms lazy chart wrappers and streaming CSV route exist.

## Related Files

- `vite.config.ts`
- `src/routes/admin.tsx`
- `src/routes/admin/charts-lazy.ts`
- `src/components/admin/DashboardCharts.tsx`
- `src/components/ui/chart.tsx`
- `src/routes/api/admin/export[.]csv.ts`
- `src/lib/admin.shared.server.ts`
- `src/lib/admin.exports.functions.ts`
- `public/sw.js`
- `src/lib/sw-register.ts`
- `src/surveys/visuals/prefetch.ts`
