# Audit 06 — Code quality

Scope: lint, types, complexity, dead code, conventions.

## Snapshot

- `bun run typecheck` (TS strict) — **passes**.
- `bun run lint` — **1 949 problems** (1 927 errors, 22 warnings); 1 865 auto-fixable.

| Rule | Count |
| --- | --- |
| `prettier/prettier` | ~1 865 (whitespace + trailing commas) |
| `no-restricted-syntax` (inline SI/TA) | 52 |
| `react-refresh/only-export-components` | 12 |
| `@typescript-eslint/no-explicit-any` | 8 |
| `react-hooks/rules-of-hooks` | **1 (real bug)** |
| `react-hooks/exhaustive-deps` | 1 |
| Unused eslint-disable directives | 9 |

## Findings

### Q-1 — Real React Hook violation _(bug)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/admin/FilteredPreviewExtras.tsx:118-121` returns early *before* calling `useState`:

```@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/admin/FilteredPreviewExtras.tsx:117-122
}) {
  if (sample.length === 0) return null;
  // Track which row is expanded to lazy-load the response detail panel.
  // Single-row expansion keeps the preview pane scannable on tablets.
  const [expandedId, setExpandedId] = useState<string | null>(null);
```

If `sample.length` ever transitions from `0` to `>0`, React unmounts/remounts the component and the order of hooks observed by React changes between renders — but more importantly, the lint rule warns that this is fragile. Move the `useState` call above the early return.

### Q-2 — `react-hooks/exhaustive-deps` warning

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:448` has a missing `current` dependency. Inspect, either add it or `// eslint-disable-next-line` with a comment explaining why.

### Q-3 — 52 inline SI/TA literals across 1 file _(real bug)_

ESLint's `no-restricted-syntax` rule flags 52 occurrences. Most cluster in `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/analytics-report-i18n.ts` (legitimate dictionary, needs allowlisting) and one each in `SurveyRunner.tsx`, `ResponseVisualSummary.tsx`, `exports-extended.ts`, `admin.tsx`. Either:

- Move strings to `i18n.tsx` / `analytics-report-i18n.ts` (the file itself is allowlisted in the rule).
- Extend the allowlist in `.eslintrc` if `analytics-report-i18n.ts` should be treated as a dictionary file.

### Q-4 — 8 `@typescript-eslint/no-explicit-any` violations

Concentrated in `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.stats.functions.ts` (Supabase filter chain) and `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/responses.functions.ts` (`update(... as any)`). Add typed helpers.

### Q-5 — 9 unused `eslint-disable` directives

Cleanup hygiene; usually a sign that lint rules were tightened later but old disables were left in place.

### Q-6 — `react-refresh/only-export-components` (12)

Mostly inside `src/components/ui/*` Radix wrappers; common and acceptable but worth fixing in net-new files.

### Q-7 — Massive Prettier diff baked into the codebase

1 865 Prettier errors means `bun run lint:fix` hasn't been run in a while. Either:

- Run `eslint --fix` + `prettier --write` once + commit (large diff).
- Add a `lint-staged` pre-commit hook so future PRs are clean.

### Q-8 — Large modules harm reviewability

| File | Lines |
| --- | --- |
| `src/routes/admin.tsx` | 4 099 |
| `src/components/SurveyRunner.tsx` | 877 |
| `src/lib/admin.shared.server.ts` | 865 |
| `src/components/ui/sidebar.tsx` | 744 |
| `src/lib/admin.stats.functions.ts` | 706 |
| `src/lib/admin.exports.functions.ts` | 627 |

The `sidebar.tsx` file is a shadcn primitive that's mostly self-contained; the others are application code worth splitting.

### Q-9 — No `lint-staged` / `husky` to gate per-commit

Add a pre-commit hook running `prettier --check` + `eslint --max-warnings 0` on staged files.

### Q-10 — Comments use `--turbo` and other slash-command hints inside files

Not user-facing but adds noise to PR reviews. Standardise on JSDoc.

## Suggested improvements

1. Fix the React Hook order bug in `FilteredPreviewExtras.tsx`.
2. Fix the `exhaustive-deps` warning in `SurveyRunner.tsx`.
3. Move/allowlist the 52 inline SI/TA literals.
4. Eliminate the 8 `as any` casts (typed Supabase helper).
5. Drop the 9 unused `eslint-disable` directives.
6. Run `bun run lint:fix` + `prettier --write` once, commit.
7. Add `husky` + `lint-staged` pre-commit hook.
8. Split the >500-line application files (admin.tsx, SurveyRunner.tsx, admin.shared.server.ts).
9. Make `bun run lint` (with `--max-warnings 0`) a CI gate.
