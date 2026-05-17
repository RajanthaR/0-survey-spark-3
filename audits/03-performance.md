# Audit 03 — Performance

Scope: bundle size, runtime, DB queries, SSR cold path, caching.

## Strengths

- **Streaming admin exports.** CSV/XLSX exports stream chunks with CRC32 + SHA256 integrity (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.shared.server.ts:148-326`).
- **Service worker caches option images.** Cache-first for hashed `/assets/` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/public/sw.js:35-77`).
- **Debounced autosave + sendBeacon flush.** No 10s polling.
- **Lazy admin charts.** Recharts split via `import("./charts-lazy")` in `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/admin/charts-lazy.tsx`.

## Findings

### P-1 — `admin.tsx` is 4 099 lines, ships eagerly _(perf)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/admin.tsx:1-100` is a single component with **85 hook calls** (`useState/useEffect/useMemo/useCallback/useRef`). Every admin visit pays the entire parse cost even if they only need exports. Split by feature (Exports, Stats, Responses, Settings) so each is a separate chunk.

### P-2 — In-memory rate limiter won't survive Worker restarts

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/responses.functions.ts` keeps a `Map` for per-IP buckets. Cloudflare Workers run as isolates; a cold start resets the map. For multi-isolate deployments the limit is ~30N where N = active isolates. Use a Durable Object or KV namespace.

### P-3 — `getStats` caps at 2 000 rows with no SQL aggregate view

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.stats.functions.ts:36-69` selects up to 2 000 rows then aggregates in JS. As response volume grows the cap will silently distort dashboards. Build a `survey_stats` SQL view and switch to a single aggregate query.

### P-4 — `getStats` does 1 + (status × 2) round-trips for filter chips

Lines 388-420 issue up to three sequential `count: 'exact', head: true` queries. Combine with `group by status` in a SQL view.

### P-5 — Pre-hydration `<script>` reads localStorage synchronously

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:147-152` runs a blocking inline script before any paint. Acceptable for now (it's tiny) but document it; future CSP hardening (no `'unsafe-inline'`) will collide here.

### P-6 — Fonts: Plus Jakarta + Fraunces + Noto Sans Sinhala + Noto Sans Tamil = ~250 KB worst case

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:120-145` requests all four families at every weight needed. Tamil/Sinhala fonts are only relevant when `lang !== "en"`. Defer loading via `media="(lang: si), (lang: ta)"` swap or `<link rel="preload" as="font" crossorigin>` only after toggle.

### P-7 — `recharts` is heavy and ships even on admin login screen

The login panel doesn't need charts. Verify `route.lazy()` defers `charts-lazy.tsx` until after auth check. If not, gate behind `if (isAdmin)`.

### P-8 — Survey questions revalidate on every render

`visibleQuestions(survey, answers)` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/survey-logic.ts:37-39`) is called on every keystroke through `SurveyRunner`. Memoize per `(slug, answersHash)`.

### P-9 — `dedupe` hash on exports recomputes per chunk

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.shared.server.ts:148-326` recomputes CRC32 and SHA256 streamingly — good — but the per-row dedupe (if any) is unclear. Verify with a load test at 50 k+ rows.

### P-10 — No image format negotiation

Option illustrations are `.webp`. Older Android in rural Sri Lanka may not handle AVIF; current `.webp` is fine. Consider `<picture>` with `.avif`/`.webp` fallback for ~30% size reduction.

## Suggested improvements (Performance)

1. Split `admin.tsx` by feature → per-route lazy chunks.
2. Replace in-memory rate limiter with KV / DO storage.
3. Add a `survey_stats` SQL view for `getStats` aggregates.
4. Defer Noto Sans fonts until the user selects SI/TA.
5. Memoize `visibleQuestions` + `progressFor` per render.
6. Add a Lighthouse budget to CI: TTI < 3.5 s on mid-tier Android, JS < 200 KB gzipped on `/`.
7. Investigate `<picture>` AVIF for option images.
