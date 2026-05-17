# Phase 0 — Tooling Baseline

## Goal

`bun run typecheck && bun run lint && bun run test` runs cleanly on a fresh
clone, and CI gates every PR on the same commands.

## Why now

Both audits agree the environment is non-reproducible:
- Codex audit `00-audit-index.md`: `bun: command not found`, Rollup native
  loading blocked by macOS code-signing, `pnpm audit` cannot run without
  `pnpm-lock.yaml`.
- My `audits/04-testing.md`: 51 failing tests; CI runs only 2 narrow
  guardrails so PRs aren't gated.

Without P0, every other phase rides on red.

## Sources

- `audits/04-testing.md` (T-6 / T-7 / T-8)
- `audits/06-code-quality.md` (Q-7 / Q-9)
- `audits/09-tech-stack.md` (St-6 / St-9 / St-10)
- `audits/10-other.md` (O-1 / O-10 / O-13)
- `audits/13-codex-parity-supplement.md` (S-19 / S-20)
- `Codex-audits/05-testing-audit.md`, `10-tech-stack-dependencies-audit.md`

## Codex Sessions

### Session 0.1 — Reproducible install + scripts (S, ~1h)

```text
Goal: Make `bun install && bun run typecheck && bun run lint && bun run test`
work on a fresh clone with documented Node fallback.

Pre-work (read-only):
- package.json
- bunfig.toml
- README.md
- audits/13-codex-parity-supplement.md (S-19)

Edits:
1. Add to package.json scripts:
   "typecheck": "tsc --noEmit",
   "lint:fix": "eslint . --fix",
   "format:check": "prettier --check ."
2. Add docs/TROUBLESHOOTING.md covering:
   - bun: command not found  (install Bun, or run binaries directly)
   - Rollup darwin-arm64 native binary code-signing
   - pnpm audit no lockfile (we use Bun)
   - the Node 24 nvm fallback path pattern
3. Add .nvmrc with the major Node version that ships in CI.
4. Add .tool-versions with `bun <pinned>` and `nodejs <pinned>`.
5. Add .gitattributes:
     src/integrations/supabase/types.ts linguist-generated=true
     src/routeTree.gen.ts linguist-generated=true merge=union
6. Commit `bun.lock` is already there — verify and document policy.

Verification:
- bun run typecheck exits 0.
- bun run lint:fix changes only whitespace (record the diff).
- bun run format:check exits 0 after lint:fix.
- TROUBLESHOOTING.md links from README.md.

Out of scope (defer): switching package managers, deleting bun.lock.
```

### Session 0.2 — Auto-format pass + Prettier baseline (S, ~30m)

```text
Goal: Drop the 1 865 prettier/prettier errors so subsequent diffs are
readable. No semantic edits.

Pre-work:
- bun run lint -- --max-warnings 0 (capture pre-state count).

Edits:
1. bun run lint:fix
2. Inspect the diff. If any change touches semantics (variable rename,
   conditional swap), abort and ask the human.
3. Confirm src/integrations/supabase/types.ts is excluded from formatting
   via .prettierignore. If not, add it.
4. Single commit: "chore: prettier auto-format pass (no semantic changes)".

Verification:
- bun run typecheck exits 0.
- bun run lint reports only no-restricted-syntax + react-* + no-explicit-any.
  Total non-prettier errors should match the pre-state count exactly.
- bun run test failures count is unchanged from main.

Out of scope: fixing the no-restricted-syntax / no-explicit-any /
react-hooks issues. Those land in P1.
```

### Session 0.3 — CI gate workflow (M, ~2h)

```text
Goal: Add .github/workflows/pr.yml that runs on every PR and gates merge.

Pre-work:
- .github/workflows/guardrails.yml (current narrow gate)
- .github/workflows/csv-export-shape.yml (existing)

Edits:
1. Create .github/workflows/pr.yml with jobs:
   - install (bun install --frozen-lockfile)
   - typecheck  (bun run typecheck)
   - lint       (bun run lint -- --max-warnings 0)
   - test       (bun run test)
   - build      (bun run build)
   - smoke      (bun run smoke against localhost preview)
   The lint job uses an --allow-warnings overlay until P1 lands the
   no-restricted-syntax fixes; once green, drop the overlay.
2. Wire CodeRabbit (or equivalent) to PR-level checks.
3. Add a status-badge to README.md.
4. Document the gate policy in CONTRIBUTING.md (Session 6.x).

Verification:
- A scratch PR fails when typecheck breaks.
- A scratch PR with prettier-only changes passes.
- Existing guardrails.yml + csv-export-shape.yml still run.

Done criteria:
- New PRs require all 5 jobs green.
- Branch protection on main asserts pr.yml as required.
```

### Session 0.4 — pre-commit hook (XS, ~20m)

```text
Goal: husky + lint-staged so PRs land clean.

Edits:
1. bun add -d husky lint-staged
2. Create .husky/pre-commit running `bun run lint-staged`.
3. lint-staged config in package.json:
   "*.{ts,tsx}": ["eslint --max-warnings 0", "prettier --check"]
   "*.{js,mjs,cjs,json,md,css,html}": ["prettier --check"]
4. Document in CONTRIBUTING.md.

Verification:
- A staged file with prettier issues fails the commit hook.
- A clean staged file commits without friction.
```

## Verification (whole phase)

```sh
bun install --frozen-lockfile
bun run typecheck   # exits 0
bun run lint        # zero errors (warnings OK until P1)
bun run test        # whatever the test count is, lock it as the baseline
bun run build       # exits 0
bun run smoke       # against http://localhost:5173 after `bun run dev`
```

## Done criteria

- [ ] `bun run typecheck` is in package.json and CI.
- [ ] `bun run lint` runs `--max-warnings 0` in CI.
- [ ] `bun run lint:fix` + `bun run format:check` exist.
- [ ] `bun.lock` committed; `pnpm-lock.yaml` not added.
- [ ] `docs/TROUBLESHOOTING.md` covers bun, Rollup native, Node fallback.
- [ ] `.nvmrc` + `.tool-versions` + `.gitattributes` committed.
- [ ] `pr.yml` runs install + typecheck + lint + test + build + smoke.
- [ ] Branch protection requires `pr.yml`.
- [ ] husky + lint-staged in place.
- [ ] CONTRIBUTING.md links from README.md.

## What this unlocks

- P1 can now reduce lint errors knowing CI catches regressions.
- P3 refactors run safely (test gate enforces).
- P4 perf measurements have a reproducible build.
