# Master TODO — In-App Project Explorer

Ordered checklist across the six lane plans. Each item maps to a session in one of the lane docs and is sized for a single Codex / Claude-Code run.

## P0 — Infrastructure (`01-infrastructure.md`)

- [ ] 0.1 — Add `/about` hub + four sub-routes; header link gated off `/s/*` and `/r/*`; lazy chunk split.
- [ ] 0.2 — Markdown loader (`loadDoc` / `listDocs`) via `import.meta.glob` + `<MarkdownView>` with react-markdown + remark-gfm + GitHub link rewrite.
- [ ] 0.3 — `<MermaidBlock>` lazy-loading Mermaid; SSR fallback; unit test.
- [ ] 0.4 — `AboutLayout` with sidebar + breadcrumbs + client-side doc search.

## P1 — Study lane (`02-study-lane.md`)

- [ ] 1.1 — Trilingual `ABOUT_STUDY` dictionary (EN / SI / TA) with non-emptiness test.
- [ ] 1.2 — Render `/about/study` page; localised `head()`; cross-lane footer links with "(English only)" note.

## P2 — Research lane (`03-research-lane.md`)

- [ ] 2.1 — `getResearchAggregatesFn` server fn; `<10` rounding; aggregate-only shape test.
- [ ] 2.2 — `<PhaseTimeline>` + `<SampleFlowDiagram>` (Mermaid).
- [ ] 2.3 — `<LiveResponseCounts>` + `<MilestoneTimeline>` (JSON-driven).
- [ ] 2.4 — Compose `/about/research` with framework + sampling-ethics Markdown placeholders; right-rail nav.

## P3 — Engineering lane (`04-engineering-lane.md`)

- [ ] 3.1 — Six Mermaid diagram sources (architecture, request lifecycle, write path, admin auth, i18n, rate-limit) + smoke test.
- [ ] 3.2 — Mode A "Architecture story" Markdown page with inline diagrams.
- [ ] 3.3 — Mode B "Doc browser" sidebar + viewer + in-app `.md` link rewriting.
- [ ] 3.4 — Mode C "Audit dashboard" parser + scoreboard + grouped table.
- [ ] 3.5 — Radix Tabs plumbing keyed off `?mode=`; per-tab lazy chunks; commit-SHA footnote.

## P3' — Presentation lane (`05-presentation-lane.md`)

- [ ] 4.1 — `<SlideDeck>` harness: keyboard, fullscreen, progress, help overlay, reduced-motion.
- [ ] 4.2 — Four slide kinds (title, text, diagram, component) with projection-sized typography.
- [ ] 4.3 — Author 13-slide initial `deck.tsx`; minimise AboutLayout chrome on present route.

## P4 — Verification + rollout (`06-verification-and-rollout.md`)

- [ ] 5.1 — Add /about routes to axe, smoke, lighthouse route lists.
- [ ] 5.2 — Bundle delta table (install size + chunk shape) captured in rollout PR.
- [ ] 5.3 — Workflow `paths-ignore` parity for this plan folder.
- [ ] 5.4 — CSP + security-header parity check on /about routes; note in master TODO files.
- [ ] 5.5 — Rollout PR composed and merged after smoke gate passes.

## Cross-lane reminders

- Every lane PR runs `bun run typecheck && bun run lint -- --max-warnings 0 && bun run format:check && bun run test && bun run build` locally before opening.
- Every lane PR captures `bun run size` output if it touches Vite/React component code so the bundle-delta table at P4 is buildable from the PR history.
- The candidate reviews every non-English string in P1 before merge.
- The candidate reviews `01-framework.md` and `02-sampling-ethics.md` placeholders in P2 and fills them in before any progress presentation.
- Engineering reviewer signs off on Mermaid diagram accuracy in P3 session 3.1 before the architecture story page composes them in 3.2.
