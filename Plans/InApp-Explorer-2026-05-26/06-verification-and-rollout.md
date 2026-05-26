# P4 — Verification and Rollout

## Goal

Every gate that already exists for the project covers the new `/about/*` routes; CI is updated where coverage is missing; bundle/perf/a11y budgets are documented; and a final rollout PR brings everything together with the candidate's sign-off on the trilingual and research content.

Done means: the `main` branch ships the four lanes, all CI workflows are green, `bun run size` and `bun run bundle:shape` numbers are recorded in the PR description, and the survey bundle has not regressed.

## Why now

- P0–P3 lanes were each gated locally on `typecheck && lint && test && build`, but the cross-cutting verifications (a11y on new routes, lighthouse on new routes, smoke on new routes, bundle delta documentation, CSP / security-header verification on the new routes) only make sense after every lane has landed.
- Catches regressions only the integrated system surfaces — e.g. Mermaid + react-markdown both being lazy-loaded in the same chunk and interacting badly with the SSR boundary.

## Worktree setup

This phase must run **after** the P0–P3 lane PRs have merged to `main`. From a clean repo:

```bash
git fetch origin
git worktree add -b feat/about-rollout ../survey-spark-3-rollout origin/main
cd ../survey-spark-3-rollout
bun install --frozen-lockfile
```

All sessions below run inside that worktree. After merge, remove with `git worktree remove ../survey-spark-3-rollout`.

## Sources

- `.github/workflows/pr.yml`, `nightly.yml`, `smoke.yml`, `guardrails.yml`, `csv-export-shape.yml`
- `playwright.config.ts`
- `scripts/smoke-ssr.mjs` (the routes list)
- `scripts/` directory in general — for `bun run size`, `bun run bundle:shape`, `bun run test:a11y`, `bun run lighthouse:ci` entry points.
- `AGENTS.md` — § Verification Notes, § CI Topology, § Runtime And Deployment.

## Sessions

### Session 5.1 — Update axe + smoke + lighthouse route lists (S, ~1h)

```text
Goal: All four /about lanes are exercised by axe, smoke, and lighthouse.

Pre-work:
- scripts/smoke-ssr.mjs — see the existing 5 canonical routes.
- The axe test source (likely under `e2e/` — read first to confirm path).
- .github/workflows/pr.yml — for the bundle/a11y jobs and the lighthouse step.
- .github/workflows/nightly.yml — for the nightly lighthouse + axe routes.

Implementation:

1. Add `/about`, `/about/study`, `/about/research`, `/about/engineering`, `/about/present` to:
   - `scripts/smoke-ssr.mjs` route list.
   - The axe routes (the a11y test file or wherever the route list is centralised).
   - The lighthouse routes for nightly.yml (only `/about` and `/about/study` need lighthouse — research/engineering/present are unlikely to be on the critical UX path for performance budgets).
2. Verify locally:
   - `bun run build && PORT=4173 HOSTNAME=127.0.0.1 node server-node.mjs &`
   - `BASE_URL=http://127.0.0.1:4173 bun run smoke` (5+5 = 10 canonical routes)
   - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 bun run test:a11y`
   - `BASE_URL=http://127.0.0.1:4173 bun run lighthouse:ci`
3. If `/about/present` triggers axe warnings due to the keyboard-only navigation pattern, document the suppression list in the test file with a comment explaining why.

Verification:
- All commands above pass locally.
- CI runs the same set on a draft PR before merging.
```

### Session 5.2 — Bundle delta documentation (S, ~1h)

```text
Goal: A short table in the rollout PR describing exactly how install size, build size, and per-route chunk size changed.

Pre-work:
- `bun run size` and `bun run bundle:shape` output before and after.
- AGENTS.md § Verification Notes (Phase 4 performance changes block).

Implementation:

1. Capture `bun run size` baseline on `main` before the lane PRs merge. Save the JSON output to a gist or local file for the rollout PR.
2. After every lane PR merges, capture `bun run size` and `bun run bundle:shape` again.
3. Diff and tabulate:
   - Install size delta (deps): react-markdown + remark-gfm + mermaid + @tailwindcss/typography.
   - Survey-bundle delta on `/`, `/s/phase-1`, `/r/$token` — must be 0.
   - New chunks introduced and which routes pull them.
4. Paste the table into the rollout PR description so the bundle story is auditable.

Verification:
- Survey-bundle delta is exactly zero.
- New chunks are owned by `/about/*` routes only.
```

### Session 5.3 — Workflow `paths-ignore` parity (S, ~30m)

```text
Goal: `Plans/InApp-Explorer-2026-05-26/` is excluded from all five workflows so plan edits don't burn CI minutes.

Pre-work:
- AGENTS.md § CI Topology
- The five workflow files under `.github/workflows/`

Implementation:

1. Add `Plans/InApp-Explorer-2026-05-26/**` (or, more cleanly, leave `Plans/**` as already excluded) to every workflow's `paths-ignore` block. Since `Plans/**` is likely already excluded, no edit may be needed — confirm by reading the workflow files.
2. If `paths-ignore` doesn't yet include `Plans/**`, add it everywhere consistently per the AGENTS.md sync rule.

Verification:
- Push a no-op edit to a file in this folder on a draft branch and confirm no workflow runs.
```

### Session 5.4 — Security & CSP sanity on new routes (S, ~1h)

```text
Goal: The new routes do not require relaxing the CSP, and the SSR-served HTML on `/about/*` continues to pass the existing security-header gates.

Pre-work:
- src/lib/security-headers.server.ts
- Codex-audits/08-security-privacy-audit.md (for the known CSP `'unsafe-inline'` finding called out in the parity supplement)

Implementation:

1. Run `bun run build && PORT=4173 HOSTNAME=127.0.0.1 node server-node.mjs` and curl each `/about/*` route. Confirm response headers (`Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`, `X-Content-Type-Options`, etc.) match `/` byte-for-byte.
2. Mermaid renders SVG via `dangerouslySetInnerHTML` (or equivalent). If Mermaid uses inline `<style>` tags in its output, the existing CSP `'unsafe-inline'` already permits it — verify, do not relax further. If Mermaid wants `<script>` or external fonts, refuse the change and configure Mermaid to avoid them.
3. Document the finding (positive or negative) in a follow-up entry in `Codex-audits/MASTER_TODO.md` and `audits/99-master-todo.md` so future audits see this checkpoint was passed.
```

### Session 5.5 — Rollout PR (S, ~1h)

```text
Goal: A single rollout PR that touches only documentation, CI, and any small integration code left over; cross-links to the lane PRs.

Pre-work:
- All previous sessions.
- The lane PR numbers / SHAs.

Implementation:

1. PR title: "About hub rollout: a11y + smoke + lighthouse coverage, bundle delta docs".
2. PR body:
   - Bundle delta table from session 5.2.
   - Link to each lane PR.
   - Verification commands run + their results.
   - Screenshots of each /about/* route + a short Loom of the presentation lane in action (optional; nice for the supervisor audience).
   - Note that translation review for /about/study is the candidate's responsibility and was completed in lane PR for P1.
3. Merge after the smoke gate on main passes.
```

## CI matrix

After P4 lands, the CI surface is:

| Workflow | Adds for /about | Existing coverage extended? |
| --- | --- | --- |
| `pr.yml` | typecheck/lint/test/build cover new routes automatically; bundle job size-checks new chunks; a11y job adds 5 routes | Yes |
| `nightly.yml` | Lighthouse adds /about and /about/study; axe adds all five /about routes | Yes |
| `smoke.yml` | All five /about routes added to the canonical route list (now 10 routes) | Yes |
| `guardrails.yml` | No change (strict subset) | No |
| `csv-export-shape.yml` | No change (orthogonal) | No |

## Done criteria

- [ ] All five /about routes pass axe locally and in CI.
- [ ] Lighthouse thresholds (LCP ≤ 2.5s, TTI ≤ 3.5s, CLS ≤ 0.1) pass for /about and /about/study.
- [ ] Smoke covers all five /about routes.
- [ ] Bundle delta table in rollout PR; survey-bundle delta is 0.
- [ ] CSP unchanged; new routes' headers match `/` byte-for-byte.
- [ ] Workflow `paths-ignore` correctly excludes this plan folder.
- [ ] Rollout PR merged after the smoke gate on main passes.

## Wrap-up — open the PR

When every "Done criteria" item above is checked and the strict gate passes from inside the worktree:

```bash
bun run typecheck && bun run lint -- --max-warnings 0 && bun run format:check && bun run test && bun run build
bun run size && bun run bundle:shape
git push -u origin feat/about-rollout
gh pr create --title "feat(about): rollout — a11y / smoke / lighthouse coverage + bundle delta docs (P4)" --body "$(cat <<'EOF'
## Summary
- Add /about routes to scripts/smoke-ssr.mjs, the axe route list, and nightly Lighthouse routes.
- Document install-size + per-route chunk delta in a table here.
- Workflow paths-ignore parity for `Plans/**` confirmed.
- CSP + security-header parity verified on /about routes.

## Plan
Implements `Plans/InApp-Explorer-2026-05-26/06-verification-and-rollout.md`. Depends on P0–P3 PRs already merged.

## Verification
- bun run typecheck — pass
- bun run lint -- --max-warnings 0 — pass
- bun run format:check — pass
- bun run test — pass
- bun run build — pass
- Local smoke against all 10 canonical routes — pass
- Local axe against all /about routes — pass
- Local lighthouse on /about and /about/study — meets LCP ≤ 2.5s / TTI ≤ 3.5s / CLS ≤ 0.1

## Bundle delta
| Route | Before | After | Δ |
| --- | --- | --- | --- |
| / | <fill> | <fill> | 0 |
| /s/phase-1 | <fill> | <fill> | 0 |
| /r/\$token | <fill> | <fill> | 0 |
| /about | n/a | <fill> | new |
| /about/engineering | n/a | <fill> | new |

(install-size delta from react-markdown + remark-gfm + mermaid + @tailwindcss/typography listed in PR comments)
EOF
)"
```

Return the PR URL when done. Merge **only after** the `smoke.yml` gate on `main` passes for the prior merges.

## Risks

- **`bun run test:a11y` may flake on `/about/present`** because the keyboard-driven slide changes confuse axe's headless run. Mitigation: snapshot the first slide for axe and skip programmatic navigation in the a11y test.
- **Lighthouse on `/about/engineering`** can be slow because of Mermaid + react-markdown bundle size. That's why this lane is excluded from the lighthouse route list — performance budgets are enforced where they matter (respondent and supervisor pages), not on internal docs.
- **Bundle delta on install size is real** (≈ 700KB unminified for Mermaid). Document this honestly. If the candidate or reviewers consider it too high, the fallback is to drop Mermaid in favour of pre-rendering SVGs at build time from `.mmd` source via `@mermaid-js/mermaid-cli`. This is a viable but more complex follow-up — not v1.
- **CI minutes:** `paths-ignore` for `Plans/**` keeps planning iteration cheap. If `Plans/**` is NOT already excluded, the very first PR for this lane will accidentally trigger full CI — call this out in the PR and fix `paths-ignore` parity in the same PR.
