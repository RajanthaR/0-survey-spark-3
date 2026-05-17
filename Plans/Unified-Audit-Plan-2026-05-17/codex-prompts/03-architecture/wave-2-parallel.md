# P3 Wave-2 — 2 parallel prompts

Fire each `## Prompt N.M` section as a **separate** Codex agent.

**Depends on:** 3.2 (admin split) fully merged. The new panel file
paths must be stable before either of these prompts runs.

Conflict matrix:

| Prompt | Owns | Touches |
| --- | --- | --- |
| 3.4 | Typed Supabase filter chain | `src/lib/admin.stats.functions.ts`, `src/lib/responses.functions.ts` |
| 3.6 | Pure helpers → `src/lib/admin/` | `src/lib/admin/*.ts` (new) + the panel files from 3.2 |

3.4 and 3.6 touch disjoint files after 3.2 lands, so both can run
concurrently.

---

## Prompt 3.4 — Type the Supabase filter chain

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Drops `as any` casts; no behaviour change.

**Goal:** Remove the 8 `as any` casts in `admin.stats.functions.ts`
and `responses.functions.ts` by introducing a typed filter helper.

**Audit ref:** `audits/06-code-quality.md` Q-4.

### TODO

1. Read first:
   - `src/lib/admin.stats.functions.ts` — focus on `applyFilters`
     callers (~lines 391, 409, 431, 474).
   - `src/lib/responses.functions.ts` — `as any` callers near lines
     89, 121, 157.
   - `node_modules/@supabase/postgrest-js/src/types.ts` — for the real
     `PostgrestFilterBuilder` shape.
2. Add a generic helper, ideally in `src/lib/admin/filters.ts`
   (after 3.6) or `src/lib/supabase-helpers.ts`:
   ```ts
   import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
   export type FilterableQuery<R> = PostgrestFilterBuilder<any, any, R>;
   export function applyFilters<R>(
     q: FilterableQuery<R>,
     filters: ResponseFilters,
   ): FilterableQuery<R> { /* same body, no as any */ }
   ```
3. Replace every `as any` cast at the listed sites.
4. For `.insert(...)` / `.update(...)` payloads in `responses.functions.ts`,
   define a local `ResponseInsertRow` type that matches the table
   shape (you can import from `src/integrations/supabase/types.ts`).
5. Behaviour MUST be identical. Run the full test suite.

### Verification

```bash
bun run typecheck
bun run lint
bun run test
grep -rn "as any" src/lib/admin.stats.functions.ts src/lib/responses.functions.ts | wc -l   # expect 0
```

### Commit & PR

- Branch: `refactor/supabase-typed-filters`
- Commit: `refactor(supabase): typed filter helper, drop as-any casts [3.4]`
- PR body refs `audits/06-code-quality.md` Q-4 and lists each cast
  removed.

### Stop conditions

- If the generated `types.ts` lacks a usable `Tables<"responses">`
  shape, STOP and ask — the generator may need a re-run.

---

## Prompt 3.6 — Move admin pure functions under `src/lib/admin/`

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Pure-function moves only; no behaviour change.

**Goal:** Pure helpers used by admin (`computeDropoff`, `detectAlerts`,
section-breakdown helpers, filter normalisation) live next to typed
contracts under `src/lib/admin/`, not inline next to JSX.

**Audit ref:** `audits/05-architecture.md` A-5.

### TODO

1. After 3.2 lands, list each panel file under
   `src/routes/admin/*/` and `src/components/admin/*`.
2. For each panel, identify pure helpers (no JSX, no hooks, no
   side-effects) that would be unit-testable in isolation.
3. Move them into:
   - `src/lib/admin/dropoff.ts` — `computeDropoff`, related types.
   - `src/lib/admin/alerts.ts` — `detectAlerts`, `categorizeAlert`.
   - `src/lib/admin/sections.ts` — section-breakdown calculations.
   - `src/lib/admin/filters.ts` — `normalizeFilters`, the typed
     helper from 3.4 (coordinate).
   - `src/lib/admin/exports-shape.ts` — pure helpers around export
     row shaping (NOT the streaming pipeline).
4. Add unit tests for each `src/lib/admin/<area>.ts` under
   `src/lib/admin/__tests__/`.
5. Panel files now import from `src/lib/admin/...`; their existing
   tests stay where they are.
6. Do NOT move impure functions (server-fn handlers, anything that
   reaches Supabase, anything that reads `window`).

### Verification

```bash
bun run typecheck
bun run lint
bun run test
find src/lib/admin -name '*.ts' -not -path '*__tests__*' | wc -l   # >= 5
find src/lib/admin/__tests__ -name '*.test.ts' | wc -l             # >= 5
```

### Commit & PR

- Branch: `refactor/admin-pure-helpers`
- Commit: `refactor(admin): pure helpers under src/lib/admin/ [3.6]`
- PR body refs `audits/05-architecture.md` A-5 and lists each file
  created.

### Stop conditions

- If a "pure" helper turns out to call a hook or `useContext`, leave
  it where it is. Note it in the PR body.
- If 3.4 has not landed yet, leave `filters.ts` empty (placeholder
  with a TODO comment); 3.4 will populate it.
