# P0 — Shared Infrastructure

## Goal

A new top-level route `/about` is reachable from a small header link, lazy-loads its own JavaScript chunk, and provides a shared layout (sidebar + breadcrumbs + search box) that all four lanes plug into. Rendering Markdown from `docs/`, `audits/`, `Codex-audits/`, and `Plans/` works through a single helper, and Mermaid is wired but not yet used by any lane.

Done means: visiting `/about` shows the four-lane hub with placeholder content for each lane, the survey bundle's `bun run size` numbers do not move, and `bun run typecheck && bun run lint && bun run test && bun run build` are all green.

## Why now

Every other lane depends on this:

- `02-study-lane.md` needs the route + layout + header link gating.
- `03-research-lane.md` needs the Markdown renderer for narrative text + the server-fn pattern.
- `04-engineering-lane.md` needs the Markdown loader + Mermaid + sidebar.
- `05-presentation-lane.md` reuses the rendered sections from the other three lanes.

Without P0, the lanes can't be reviewed in isolation.

## Worktree setup

Run once at the start of this phase so the other phases can be developed in parallel without merge contention:

```bash
git fetch origin
git worktree add -b feat/about-infra ../survey-spark-3-infra origin/main
cd ../survey-spark-3-infra
bun install --frozen-lockfile
```

All sessions below run inside that worktree. When the phase is done, the wrap-up section creates the PR; after merge, remove the worktree with `git worktree remove ../survey-spark-3-infra` and delete the branch.

## Sources

- `src/routes/__root.tsx` — global layout, where the header link will land.
- `src/routes/index.tsx` — current public landing, for visual / Tailwind parity.
- `src/router.tsx`, `src/routeTree.gen.ts` — file-based routing; new files create new routes automatically.
- `vite.config.ts` — for the new `?raw` glob import or build-time index. Bundle splitting config already exists; we extend it for `/about`.
- `AGENTS.md` § "Server Boundaries" — for the rule that `*.server.*` modules cannot be statically imported from the client graph. Constrains the Markdown loader if any of it needs Node APIs.
- `package.json` — for adding `react-markdown`, `remark-gfm`, and `mermaid` under `dependencies`. Keep them out of `devDependencies` because they ship to the browser.

## Sessions

### Session 0.1 — Add route hub + lazy chunk boundary (M, ~2h)

```text
Goal: Add `/about` and four placeholder sub-routes (`/about/study`, `/about/research`, `/about/engineering`, `/about/present`), all lazy-loaded into a single shared chunk separate from the survey bundle.

Pre-work (read-only):
- src/routes/__root.tsx
- src/routes/index.tsx
- src/routes/admin.tsx (only to see how it's structured, NOT to copy its size)
- src/routeTree.gen.ts (do not edit by hand)
- vite.config.ts
- AGENTS.md § Server Boundaries

Implementation:

1. Create `src/routes/about.tsx` as a layout route exporting a TanStack Route with:
   - `head()` returning meta tags (title "About this research — EIP Insight", description tuned per-lane via context).
   - A component rendering `<AboutLayout><Outlet /></AboutLayout>` where `AboutLayout` lives in `src/about/layout/AboutLayout.tsx`.
2. Create `src/routes/about.index.tsx` (the hub landing), and `src/routes/about.study.tsx`, `src/routes/about.research.tsx`, `src/routes/about.engineering.tsx`, `src/routes/about.present.tsx`. Each is placeholder content for now: a heading + "Coming in lane $N — see Plans/InApp-Explorer-2026-05-26/0$N-*.md".
3. The hub landing renders a 2x2 grid of cards, one per lane, using the same Tailwind utility classes as the survey-list cards in `src/routes/index.tsx` for visual consistency (`rounded-2xl border bg-card p-5 transition hover:bg-accent/30`).
4. Add an `/about` link to `src/routes/__root.tsx` in the global header. The link is shown only on routes where the pathname does NOT start with `/s/` or `/r/`. Use `useRouterState({ select: s => s.location.pathname })` and an inline conditional. Label: "About this research" / Sinhala / Tamil — wire to a new `aboutLink` entry in the `UI` dict (`src/lib/i18n.ts`).
5. Confirm via build output that `/about/*` produces a chunk distinct from `index` and `s.$slug`. If Vite doesn't split it automatically, add an explicit `manualChunks` entry for `about` in `vite.config.ts`.

Out of scope this session:
- Markdown renderer (session 0.2)
- Mermaid (session 0.3)
- Real lane content (P1–P3)

Verification:
- bun run typecheck
- bun run lint -- --max-warnings 0
- bun run build && bun run size  # /about must not enlarge the survey bundle
- bun run test (no new tests required this session)
- Manually: `bun run dev`, click "About this research" from `/`, see hub. Visit `/s/phase-1` and confirm the header link is hidden.
```

### Session 0.2 — Markdown loader + react-markdown renderer (M, ~2h)

```text
Goal: A helper `loadDoc(path)` synchronously returns the raw Markdown source of a tracked file in `docs/`, `audits/`, `Codex-audits/`, or `Plans/`, and a React component `<MarkdownView source={…} basePath={…} />` renders it with GFM tables, task lists, fenced code, and footnotes.

Pre-work (read-only):
- vite.config.ts
- The file tree under `docs/`, `audits/`, `Codex-audits/`, `Plans/`.
- AGENTS.md § Formatting And Generated Files (these folders are excluded from formatter churn — the loader must NOT round-trip through prettier).

Implementation:

1. Add deps: `react-markdown`, `remark-gfm`. Pin to current stable. Confirm `bun audit --audit-level=moderate` stays clean.
2. Create `src/about/lib/load-doc.ts`:
   - Uses `import.meta.glob` with `{ as: 'raw', eager: true }` across `/docs/**/*.md`, `/audits/**/*.md`, `/Codex-audits/**/*.md`, `/Plans/**/*.md`.
   - Exports `loadDoc(repoRelPath: string): string | undefined` and `listDocs(prefix: string): string[]`.
   - Repo-relative paths in (e.g. `"docs/DEPLOYMENT.md"`), strings out.
3. Create `src/about/components/MarkdownView.tsx`:
   - Wraps `react-markdown` with `remark-gfm`.
   - Overrides `<a>` to rewrite repo-relative links into `https://github.com/RajanthaR/survey-spark-3/blob/<commitSha>/...` using a build-time-injected `__COMMIT_SHA__` constant. (Add the constant via `vite.config.ts` `define`; fall back to `"main"` in dev.)
   - Overrides `<code className="language-mermaid">` to render `<MermaidBlock source={…} />` (component arrives in session 0.3 — for now, render a stub `<pre>` with the source so the seam exists).
   - Adds Tailwind prose classes (`prose prose-slate max-w-none dark:prose-invert`) — install `@tailwindcss/typography` if not already in deps; it is widely used and tiny.
4. Add a unit test `src/about/lib/__tests__/load-doc.test.ts`:
   - Verifies `loadDoc("docs/DEPLOYMENT.md")` returns a non-empty string starting with `# `.
   - Verifies `listDocs("audits/")` returns ≥ 12 entries.
   - Verifies a non-existent path returns `undefined`.

Out of scope:
- Sidebar / breadcrumbs / search (session 0.4).
- Mermaid (session 0.3).
- Trilingual respondent strings (P1).

Verification:
- bun run typecheck
- bun run lint -- --max-warnings 0
- bun run test -- src/about/lib/__tests__/load-doc.test.ts
- bun run build && bun run size (delta must be in /about chunk only)
```

### Session 0.3 — Mermaid block component, lazy-loaded (S, ~1h)

```text
Goal: A `<MermaidBlock source={mmd} />` component renders Mermaid diagrams client-side, with the `mermaid` package code-split so it never enters the initial bundle of any route. SSR returns a placeholder; hydration swaps in the rendered SVG.

Pre-work (read-only):
- `mermaid` README on the npm page for current API.
- `src/about/components/MarkdownView.tsx` — to confirm the seam from session 0.2.

Implementation:

1. Add dep: `mermaid`. Confirm `bun audit` clean.
2. Create `src/about/components/MermaidBlock.tsx`:
   - `useEffect` that does `const mermaid = (await import('mermaid')).default; mermaid.initialize({ startOnLoad: false, theme: 'default' }); const { svg } = await mermaid.render(id, source); setSvg(svg);`.
   - Before hydration, renders `<pre className="text-xs">{source}</pre>` so SSR has fallback content.
   - Catches parse errors and renders the source + a small error notice instead of throwing.
3. Wire it into `MarkdownView` by replacing the session-0.2 stub.
4. Create `src/about/diagrams/` and add a placeholder `_smoke.mmd` (e.g. `graph TD; A-->B`) plus a unit/integration test `src/about/components/__tests__/MermaidBlock.test.tsx` using Testing Library + `vi.mock('mermaid', ...)` that asserts the placeholder pre tag is shown before hydration and that on hydration, `mermaid.render` is invoked exactly once with the source string.
5. Verify `bun run bundle:shape` shows the `mermaid` chunk as a lazy import owned by `/about`.

Verification:
- bun run typecheck && bun run lint && bun run test
- bun run build && bun run bundle:shape  # confirm mermaid is its own chunk
```

### Session 0.4 — AboutLayout: sidebar + breadcrumbs + search (M, ~2h)

```text
Goal: A reusable layout component for all `/about/*` lanes, with a left sidebar listing the four lanes, a breadcrumb trail, and a client-only search box that filters the loaded Markdown corpus by title and headings.

Pre-work (read-only):
- `src/about/lib/load-doc.ts` (session 0.2)
- `src/components/ui/` — existing shadcn primitives to reuse (Input, Card, Separator).

Implementation:

1. Create `src/about/layout/AboutLayout.tsx`:
   - Two-column desktop layout (sidebar 240px / content). On mobile, sidebar collapses to a dropdown above the content.
   - Sidebar items: the four lanes, with active-state styling driven by `useRouterState`.
   - Breadcrumbs derived from `useMatches()` — "About" → lane name → optional document title (the lane sets this via route loader).
2. Add a client-only `<DocSearch />` component:
   - On mount, builds an in-memory index from `listDocs("")` + the first `# Heading` line of each file (regex parse from `loadDoc`).
   - Renders an `<Input>` + popover of matches. Selecting a match navigates to the engineering-lane viewer route (created in P2; for now, route to `/about/engineering?doc=<path>` and let the placeholder render the path).
3. The `AboutLayout` exports a `useAboutSection(name, label, docTitle?)` hook the lane pages call from a `useEffect` to set the breadcrumb segment.
4. Unit-test the sidebar's active-state logic and the search index's title-extraction regex.

Verification:
- bun run typecheck && bun run lint && bun run test
- Manually: visit `/about`, navigate to each placeholder lane, confirm sidebar active state, breadcrumbs, search.
- Run `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 bun run test:a11y` after adding `/about` to the axe routes (this happens in P4 — note here that the layout was authored with axe in mind).
```

## Done criteria

- [ ] `/about` and the four sub-routes exist and render placeholder content.
- [ ] Header "About this research" link is visible on `/`, `/admin`, etc., but hidden on `/s/$slug` and `/r/$token`. Verified via Playwright in P4.
- [ ] `loadDoc()` returns Markdown for any tracked file in `docs/`, `audits/`, `Codex-audits/`, `Plans/`.
- [ ] `<MarkdownView>` renders GFM tables, code blocks, footnotes correctly.
- [ ] `<MermaidBlock>` renders a smoke diagram client-side; SSR shows the `.mmd` source.
- [ ] `AboutLayout` sidebar reflects active lane; search matches against doc titles.
- [ ] `bun run build && bun run size` show no regression on `/`, `/s/phase-1`, `/r/$token`. The `mermaid` and `react-markdown` chunks appear only as lazy children of `/about`.
- [ ] `bun run typecheck && bun run lint -- --max-warnings 0 && bun run format:check && bun run test && bun run build` are all green.
- [ ] New unit tests pass: `load-doc.test.ts`, `MermaidBlock.test.tsx`.

## Wrap-up — open the PR

When every "Done criteria" item above is checked and the strict gate passes from inside the worktree:

```bash
bun run typecheck && bun run lint -- --max-warnings 0 && bun run format:check && bun run test && bun run build
git push -u origin feat/about-infra
gh pr create --title "feat(about): /about hub + Markdown/Mermaid infrastructure (P0)" --body "$(cat <<'EOF'
## Summary
- Add `/about` route hub with four placeholder lanes, header link gated off survey routes.
- Add Markdown loader + react-markdown renderer with GFM and GitHub link rewrite.
- Add lazy-loaded `<MermaidBlock>` with SSR fallback.
- Add `AboutLayout` (sidebar + breadcrumbs + client-side doc search).

## Plan
Implements `Plans/InApp-Explorer-2026-05-26/01-infrastructure.md`. Unblocks P1–P3 lane PRs.

## Verification
- bun run typecheck — pass
- bun run lint -- --max-warnings 0 — pass
- bun run format:check — pass
- bun run test — pass (new: load-doc.test.ts, MermaidBlock.test.tsx)
- bun run build — pass
- bun run size — survey bundle unchanged on /, /s/phase-1, /r/\$token

## Notes
This PR is a hard prerequisite for the P1/P2/P3 lane PRs, which are designed to run in parallel against the same `main` after this lands.
EOF
)"
```

Return the PR URL when done. Do not merge any P1–P3 lane PR until this one is merged.

## Risks

- **`@tailwindcss/typography` rendering may clash with the existing design tokens.** Mitigation: scope `prose` to inside the AboutLayout content column only.
- **`import.meta.glob` with `eager: true` ships every tracked Markdown file into the `/about` chunk.** That is intentional (≈ 200 KB after gzip across `docs/` + `audits/` + `Codex-audits/` + `Plans/`) but call it out in the rollout PR. If the size proves problematic, switch to `eager: false` and route-loader-driven async loads — but that complicates SSR. Default to eager for v1.
- **Generated `routeTree.gen.ts` may need a regen.** The build will do this automatically; do not hand-edit. If a stale tree commits, the lane PRs will show diffs in that file — accept them.
