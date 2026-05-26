# P3 — Engineering Lane (`/about/engineering`)

## Goal

A reviewer-grade engineering surface that renders the existing `docs/`, `audits/`, `Codex-audits/`, and `Plans/` Markdown directly in-app, augmented with hand-authored Mermaid diagrams for the architecture, request lifecycle, Turnstile flow, rate-limit flow, and i18n pipeline, plus an audit-progress dashboard derived from `Codex-audits/MASTER_TODO.md` and `audits/99-master-todo.md`.

Done means: a senior engineer landing on `/about/engineering` cold can build an accurate mental model of how the system works, see the current audit posture at a glance, and click through to any doc without needing the repo open.

## Why now

- Highest-leverage lane: turns ≈ 40 existing Markdown files into a navigable, searchable, visually-augmented reference.
- Forces the Mermaid + sidebar + search infrastructure from P0 to actually carry weight, which is the right way to validate that infra.
- Establishes the GitHub deep-link rewriting and the audit-parsing pattern that the presentation lane (P3) reuses for the "engineering walkthrough" slides.

## Sources

- `docs/DEPLOYMENT.md`, `docs/RAILWAY-MIGRATION.md`, `docs/RESEARCHER_OPS.md`, `docs/ADMIN_ONBOARDING.md`, `docs/BACKUP_RESTORE.md`, `docs/UX-PATTERNS.md`, `docs/TROUBLESHOOTING.md`, `docs/A11Y-SWEEP-2026-05.md`, `docs/PRODUCTION-BROWSER-TEST-AGENT.md`, `docs/plans/option-visuals.md`.
- `audits/00-overview.md` through `audits/13-codex-parity-supplement.md`, plus `audits/99-master-todo.md`.
- `Codex-audits/00-audit-index.md` through `Codex-audits/12-product-admin-workflows-audit.md`, plus `Codex-audits/MASTER_TODO.md`.
- `Plans/` (all subfolders, including `Unified-Audit-Plan-2026-05-17/` and this folder).
- `AGENTS.md` — for the architecture rules that must be reflected in the diagrams (server boundaries, runtime topology, rate-limit fallback, etc.).
- `README.md` — for the headline architecture summary.
- `package.json` + `vite.config.ts` + `server-node.mjs` — referenced from the architecture diagram.

## Content plan

The lane has three modes the user can switch between via tabs at the top of the content column:

### Mode A — "Architecture story" (default view)

A hand-curated, single-scroll page that walks an engineer through the system end-to-end. Uses inline Mermaid diagrams + short prose. Hand-authored, not auto-generated. Sections:

1. **System at a glance** — `architecture-overview.mmd` diagram: browser → Cloudflare/Railway edge → Node `server-node.mjs` → TanStack Start fetch handler → Supabase + Redis. Includes the build/runtime split (Bun → Vite → `dist/server` + `dist/client`).
2. **Request lifecycle** — `request-lifecycle.mmd`: an HTTP request entering `server-node.mjs`, classification (static vs SSR), security headers (`src/lib/security-headers.server.ts`), rate-limit check, Turnstile verification on protected POSTs, server fn dispatch, response.
3. **Survey response write path** — `survey-write-path.mmd`: form submit → server fn → Turnstile verify → rate-limit token bucket → Supabase service-role insert → resume-token issuance.
4. **Auth + admin path** — `admin-auth-path.mmd`: Supabase magic-link / password sign-in → role check (`user_roles`) → admin analytics queries.
5. **i18n pipeline** — `i18n-pipeline.mmd`: source-of-truth dictionaries in `src/lib/i18n.ts` + survey files → `useLang` reader → `pickText` rendering, with the resume-token language precedence path called out (per the recent commit "Clarify resume language precedence and labels").
6. **Rate limit + Redis fallback** — `rate-limit.mmd`: token-bucket Lua script in Redis when `REDIS_URL` is set; per-process Map fallback when unset or transient failures occur (with the log line and the "safe for local/test, breaks across replicas" caveat from `AGENTS.md`).

Each section is short prose (2–4 paragraphs) below the diagram, with inline links into the rendered docs/audits.

### Mode B — "Doc browser"

A two-column view (sidebar of all tracked docs + content pane rendering the selected file). Query param `?doc=<repo-rel-path>` selects the file. Sidebar is grouped:

- **docs/** — operational runbooks
- **audits/** — audit set v1
- **Codex-audits/** — audit set v2
- **Plans/** — implementation plans

Every internal link in the rendered Markdown — relative or `[label](other-doc.md)` — is rewritten to navigate within the doc browser (preserve in-app navigation rather than launching out to GitHub). Links to source files (e.g. `src/...`) rewrite to GitHub blob links keyed off the current commit SHA per P0 session 0.2.

### Mode C — "Audit dashboard"

Parses `Codex-audits/MASTER_TODO.md` and `audits/99-master-todo.md`, extracts the checklist items, and renders:

- A top-line `<AuditScoreboard>` — total items, done, in-progress, open, per audit set.
- A grouped table per topic (content, UX, a11y, perf, testing, architecture, code quality, security, i18n, deps, DB, workflows), one row per item with status, severity (if present in the source), and a link into the originating audit file in mode B.
- Per-topic sparkline if there is enough historical signal (e.g. comparing `audits/` vs `Codex-audits/` overlap). Skip if it adds confusion.

## Sessions

### Session 3.1 — Mermaid diagram sources, hand-authored (M, ~3h)

```text
Goal: Six tracked Mermaid sources under `src/about/diagrams/` rendering accurately for the architecture-story sections.

Pre-work (read-only):
- AGENTS.md § Runtime And Deployment, § Server Boundaries
- README.md § Tech Stack, § Deployment
- server-node.mjs (the actual Node entry — anchor diagrams to real names, not invented ones)
- src/server.ts (Web-Fetch handler)
- src/lib/rate-limit.server.ts (for the Redis/in-memory fallback)
- src/lib/security-headers.server.ts (for the headers step in the request-lifecycle diagram)
- src/lib/i18n.ts (for the i18n pipeline diagram)

Implementation:

1. Author six `.mmd` files: `architecture-overview.mmd`, `request-lifecycle.mmd`, `survey-write-path.mmd`, `admin-auth-path.mmd`, `i18n-pipeline.mmd`, `rate-limit.mmd`.
2. Each diagram source includes a short HTML comment at the top with a one-sentence purpose and the date authored, so future maintainers know what the diagram is claiming.
3. Every node label corresponds to a real file/module/component name. Reviewer test: can a reader grep the codebase for any label in a diagram and find the thing it refers to?
4. Add a smoke test `src/about/diagrams/__tests__/diagrams.test.ts` that imports each `.mmd?raw` file and asserts: (a) non-empty, (b) starts with a recognised Mermaid header (`graph `, `flowchart `, `sequenceDiagram`, `timeline `).
5. Iterate the diagrams with at least one engineer reviewer before merging. The diagrams ARE the architecture story for any future contributor — getting them wrong is worse than not shipping them.
```

### Session 3.2 — Mode A: Architecture story page (M, ~2h)

```text
Goal: A single scrollable view at `/about/engineering` (default tab) renders the six diagrams with prose between them.

Pre-work:
- Session 3.1 outputs.
- src/about/components/MarkdownView.tsx (P0 session 0.2)
- src/about/components/MermaidBlock.tsx (P0 session 0.3)

Implementation:

1. Create `src/about/content/engineering/architecture-story.md` — one Markdown file with six `<section>` HTML wrappers and inline ```mermaid``` code blocks referencing each diagram. The Markdown loader from P0 doesn't transform fenced ```mermaid``` blocks specially; instead, the `MarkdownView` override (P0 session 0.2) routes them through `<MermaidBlock>`. Verify this path works end-to-end here.
2. Author the prose between diagrams. Keep it terse — 2–4 paragraphs per section. Cross-link to the relevant `docs/*.md` (which open in mode B).
3. In `src/routes/about.engineering.tsx`, implement tab switching (the three modes). Tab state lives in a query param `?mode=story|browser|dashboard` so the URL is shareable.
4. The "Architecture story" tab renders the Markdown file via `<MarkdownView>`.

Verification:
- bun run typecheck && bun run lint && bun run test
- Manually: visit `/about/engineering`, see all six diagrams render, click each cross-link and confirm in-app navigation.
```

### Session 3.3 — Mode B: Doc browser (M, ~2h)

```text
Goal: A grouped sidebar of all tracked Markdown files + a content pane rendering the selected file. Internal Markdown links navigate in-app.

Pre-work:
- src/about/lib/load-doc.ts (P0 session 0.2)
- src/about/components/MarkdownView.tsx (P0 session 0.2)

Implementation:

1. Create `src/about/components/engineering/DocSidebar.tsx`:
   - Calls `listDocs("docs/")`, `listDocs("audits/")`, `listDocs("Codex-audits/")`, `listDocs("Plans/")` and groups them under collapsible headers.
   - For each doc, extracts the `# Title` from the first non-empty heading line via the helper introduced in P0 session 0.4.
   - Active state driven by `?doc=` query param.
2. Create `src/about/components/engineering/DocViewer.tsx`:
   - Reads `?doc=<path>`, calls `loadDoc(path)`, passes to `<MarkdownView source={…} basePath={dirname(path)} />`.
   - On a missing doc, renders a friendly "not found" with a link back to the sidebar.
3. Extend `MarkdownView`'s `<a>` override so that `href`s ending in `.md` (relative or absolute repo-relative) navigate to `/about/engineering?mode=browser&doc=<resolved-path>` instead of opening a new tab.
4. Add a unit test for the link-rewriting logic: given a doc at `audits/00-overview.md` and a link `[T-6](04-testing.md#t-6)`, the rewritten href is `/about/engineering?mode=browser&doc=audits/04-testing.md#t-6`.

Verification:
- bun run typecheck && bun run lint && bun run test
- Manually: navigate `/about/engineering?mode=browser`, expand each group, open three docs from different folders, click cross-doc links and confirm in-app nav.
```

### Session 3.4 — Mode C: Audit dashboard (M, ~2.5h)

```text
Goal: Parse the two master TODO files and render an audit scoreboard + grouped tables.

Pre-work:
- Codex-audits/MASTER_TODO.md
- audits/99-master-todo.md
- audits/00-overview.md (for the topic taxonomy)
- The 12 audit files in each folder (for severity / id parsing if present).

Implementation:

1. Create `src/about/lib/audit-parser.ts`:
   - Exports `parseMasterTodo(source: string, origin: 'audits' | 'codex-audits'): AuditItem[]`.
   - An `AuditItem` is `{ id?: string; title: string; status: 'done' | 'in-progress' | 'open'; severity?: 'critical' | 'high' | 'medium' | 'low'; topic: string; sourceFile?: string; }`.
   - Parser recognises Markdown task-list syntax (`- [x]`, `- [ ]`, `- [/]` if used), nested topic headings (`## Content`, etc.), and pulls IDs like `T-6` from the start of an item.
   - Pure function; unit-tested with fixtures pasted from the actual files.
2. Create `src/about/components/engineering/AuditScoreboard.tsx`:
   - Top tiles: total items per origin (audits / Codex-audits), done %, open count, in-progress count.
   - Grouped table: rows of `AuditItem`, with status pill, severity pill, title, and a link to the source audit file in mode B.
3. Add unit tests for `parseMasterTodo` covering: an item with checked box + ID, an item with severity tag, a topic-heading transition, an unknown line (ignored).
4. Default sort: status (open > in-progress > done), then severity, then ID.

Verification:
- bun run typecheck && bun run lint && bun run test (parser tests must cover ≥ 80% of branches)
- Manually: visit `/about/engineering?mode=dashboard`, confirm numbers reconcile against eyeballing the source files.
```

### Session 3.5 — Tab plumbing + final composition (S, ~1h)

```text
Goal: The three tabs (story / browser / dashboard) live behind `?mode=` and the page is keyboard-accessible.

Pre-work:
- Sessions 3.2, 3.3, 3.4.
- src/about/layout/AboutLayout.tsx — confirm the layout's content column gives mode B enough horizontal room.

Implementation:

1. Tab UI uses Radix Tabs (already in `components/ui/`) wrapped with controlled `value` from the query param.
2. Tab labels: "Architecture", "Docs", "Audit status". Pre-select "Architecture" if no `?mode=` present.
3. Each tab content is a separately-lazy chunk so opening "Architecture" alone doesn't pay for the audit parser or vice versa.
4. Add a small "Last build SHA: <sha>" footnote at the bottom of the page using the `__COMMIT_SHA__` constant from P0 session 0.2, so a reviewer can correlate what they're reading with the deployed version.

Verification:
- bun run typecheck && bun run lint && bun run test && bun run build
- bun run bundle:shape  # confirm three tab chunks + react-markdown + mermaid all sit under /about
- Tab through the page with the keyboard. Confirm focus order and visible focus ring on tab triggers.
```

## Done criteria

- [ ] Six tracked `.mmd` diagram sources exist under `src/about/diagrams/` and pass the smoke test.
- [ ] Architecture story page renders all six diagrams with prose and cross-links into the doc browser.
- [ ] Doc browser shows grouped sidebar + content pane; internal `.md` links navigate in-app.
- [ ] Markdown-link unit test passes.
- [ ] Audit parser handles task-list syntax, topic headings, IDs, and severity tags; parser unit tests at ≥ 80% branch coverage.
- [ ] Audit dashboard renders scoreboard + grouped table; numbers reconcile manually.
- [ ] Tabs are keyboard-accessible; `?mode=` URL is shareable.
- [ ] All gates green: `typecheck && lint && test && build && bundle:shape`. Survey-bundle size unchanged.

## Risks

- **Diagrams encode current architecture and rot.** Mitigation: each diagram's source-comment header includes the date authored. P4 rollout adds the diagrams to the audit checklist so any change to `server-node.mjs`, `src/server.ts`, `src/lib/rate-limit.server.ts`, `src/lib/security-headers.server.ts`, or `src/lib/i18n.ts` triggers a manual diagram review on the PR.
- **Audit parser brittleness.** Markdown is loose; if the master TODO format changes the parser silently misclassifies items. Mitigation: parser tests use the actual current files as fixtures; tests will fail when the format drifts, forcing an explicit update.
- **Doc browser may surface incomplete or contradictory audit notes.** Mitigation: every audit doc already has a date in its header; the doc browser shows the date prominently above the content so readers know what they're reading.
- **`Plans/` includes this folder.** That's intentional — the meta-plan is visible from the in-app tooling that the plan delivers. Make sure the rendered output of `00-README.md` and friends still makes sense in that context (it does, per the existing copy).
- **The architecture story is hand-authored prose** that will inevitably drift from reality faster than the diagrams. Mitigation: keep it terse and rely on cross-links into the runbooks for current-state detail.
