# In-App Project Explorer — 2026-05-26

A documentation-only development plan for adding an in-app "explore this project" surface to Survey Spark 3. The surface is designed to support:

- **A PhD student's progress presentations** (the survey is her research instrument).
- **Supervisors and examiners** reading about the study without touching the repo.
- **Engineering reviewers and collaborators** reading architecture, security, and audit docs in context.
- **Survey respondents** wanting a short "about this study" page.

Nothing in this plan ships code. Every file under this folder is a self-contained Codex/Claude-Code session prompt that can be picked up and executed independently, in the order set by [10-master-todo.md](./10-master-todo.md) (added after the lane plans).

## Why this is needed

The repository already contains substantial high-quality prose:

- `docs/` — Researcher Ops, Admin Onboarding, Deployment, Backup/Restore, UX Patterns, A11y sweep, Railway migration, Troubleshooting.
- `audits/` and `Codex-audits/` — 12 topical audits each, plus master TODOs.
- `Plans/` — Unified audit plan, post-audit plan, Turnstile integration plan, AuditV2 fixes.

None of this is reachable from the running app. The public surface today is just `src/routes/index.tsx` (survey list) + a footer link to `/admin`. A reviewer who lands on the deployed URL has no way to learn what the project is, why it is built the way it is, or where to read more — and the PhD candidate has no live, browser-driven story to drive a progress presentation from.

This plan turns the existing Markdown into a first-class in-app experience without duplicating it.

## What this folder contains

| File | Purpose |
| --- | --- |
| `00-README.md` | This file. Read first. |
| `01-infrastructure.md` | Shared infra: `/about` routing, Markdown loader, react-markdown + remark-gfm, Mermaid lazy-load, layout, header link gating. |
| `02-study-lane.md` | `/about/study` — trilingual respondent-facing "about this research" page. |
| `03-research-lane.md` | `/about/research` — study-design narrative for supervisors / committee. Live response counts, phase timeline, sample-flow diagram. |
| `04-engineering-lane.md` | `/about/engineering` — architecture, security, and audit doc viewer with diagrams and an audit dashboard. |
| `05-presentation-lane.md` | `/about/present` — keyboard-driven slideshow mode for live presentations. |
| `06-verification-and-rollout.md` | Tests, bundle/perf budget impact, a11y/lighthouse coverage, PR sequencing, keeping CI green. |
| `10-master-todo.md` | Single ordered checklist across lanes. *(Generated at the end of plan-writing, once all lanes settle.)* |

## Audience-to-lane mapping

| Lane | Primary audience | Language | Live data? | New deps it forces |
| --- | --- | --- | --- | --- |
| `/about/study` | Survey respondents (public) | EN / SI / TA | No | None — uses existing `pickText` / `UI` dict pattern. |
| `/about/research` | PhD supervisors / committee | EN | Yes — anonymised response counts from Supabase | `recharts` (already in repo). |
| `/about/engineering` | Engineering reviewers / collaborators | EN | No (read-time) | `react-markdown`, `remark-gfm`, `mermaid` — lazy-loaded only on `/about/*`. |
| `/about/present` | The candidate herself (live presentations) | EN | No | None beyond `framer-motion` (already in repo). |

All four lanes share the layout and Markdown infrastructure defined in [01-infrastructure.md](./01-infrastructure.md).

## Scope boundaries

**In scope:**

- A new top-level `/about` route hub with the four lanes above.
- A small "About this research" link in the global header, hidden on survey-session routes (`/s/$slug`, `/r/$token`) so respondents are never distracted mid-survey.
- A Markdown rendering pipeline that reads from `docs/`, `audits/`, `Codex-audits/`, and `Plans/` at build time.
- Hand-authored Mermaid source for architecture, request lifecycle, Turnstile, rate-limit, and i18n diagrams. Mermaid source lives in `src/about/diagrams/*.mmd` so it can be reviewed independently of the renderer.
- An audit dashboard parsed from `Codex-audits/MASTER_TODO.md` and/or `audits/99-master-todo.md`.
- Trilingual respondent copy for `/about/study` (new entries in the `UI` dict).
- Tests: a11y (axe) coverage for all `/about/*` routes; unit tests for Markdown loader + audit-dashboard parser; smoke for the four routes.

**Out of scope (deliberately):**

- Editing or restructuring any existing `docs/`, `audits/`, `Codex-audits/`, or `Plans/` file. The rendering layer reads them; it does not own them. They keep their existing CI exclusions in the workflow `paths-ignore` block.
- Adding a CMS or any kind of in-app editor.
- Server-side rendering of audit content beyond what TanStack Start already does for the rest of the app — these routes are SSR by default, no special-casing.
- Authentication on `/about/*`. The lane is discoverable-but-unlinked-from-survey-flow per the design decision; no soft passphrase or admin gating.
- Trilingual translation of `/about/research` and `/about/engineering`. Those lanes are EN-only. (See `02-study-lane.md` for why only the respondent lane is trilingual.)
- Auto-generated diagrams from source code. All diagrams are hand-authored Mermaid and live under version control.

## Non-negotiable constraints

The plan inherits these from the existing project:

1. **Survey bundle untouched.** `/about/*` and every dependency it pulls in must be lazy-loaded so that `bun run size` numbers on `/`, `/s/phase-1`, and `/r/$token` do not regress. Verified per `06-verification-and-rollout.md`.
2. **No regressions in `bun run typecheck && bun run lint -- --max-warnings 0 && bun run format:check && bun run test && bun run build`.** Every lane PR runs this gate locally before opening.
3. **A11y parity.** All `/about/*` routes pass the same axe rules as `/`, `/s/phase-1`, `/admin`. Routes are added to the local + CI axe sweep.
4. **Server boundaries respected.** `src/about/*` is client-graph code. Anything that needs Supabase data (e.g. live response counts on `/about/research`) goes through a `createServerFn` and a `*.impl.server.ts` module per the rules in `AGENTS.md`.
5. **`paths-ignore` parity.** `Plans/InApp-Explorer-2026-05-26/` is added to the workflow `paths-ignore` block in all five workflows under `.github/workflows/`. The plan folder itself never triggers CI.

## Build order

```
P0 infrastructure (01) → P1 study lane (02) ─┐
                       → P2 engineering lane (04) ─┼─→ P3 present lane (05) → P4 rollout (06)
                       → P3 research lane (03) ───┘
```

- **P0 — infrastructure** is a hard prerequisite. Nothing else compiles without the `/about` hub, the Markdown loader, and the lazy chunk boundary.
- **P1, P2, P3 lanes** are independent of each other after P0 lands. They can be picked up in any order and parallelised across sessions. The order in the diagram above is a suggested optimisation: study lane is the smallest and unblocks the header link; engineering lane builds the Mermaid infrastructure that the presentation lane reuses; research lane needs a Supabase server-fn so it's the highest-risk lane and is best left for last among the content lanes.
- **P3 — presentation** depends on the other lanes having content to slide through. It can start in parallel using fixture content, but final slide selection waits.
- **P4 — rollout** is the only lane that must come last. It edits CI, lighthouse routes, and the axe sweep.

## Risks and tradeoffs called out up front

| Risk | Mitigation |
| --- | --- |
| Adding `react-markdown` + `remark-gfm` + `mermaid` bloats install size and audit surface. | Pinned and added under a single PR with `bun audit --audit-level=moderate` clean. Lazy-loaded behind the `/about` chunk boundary so the survey bundle pays nothing. Bundle delta documented in the rollout PR. |
| Mermaid is large (~700KB unminified). | Lazy `import()` inside the diagram component; never enters the initial chunk. Verified in `bun run bundle:shape` output. |
| Live Supabase counts on `/about/research` could leak more than the existing admin analytics already expose. | Server fn returns only aggregated counts (no row-level data); same RLS/service-role posture as existing `responses` reads. Documented in `03-research-lane.md`. |
| Markdown content from `audits/` references file paths and line numbers that drift over time. | Renderer rewrites repo-relative paths into GitHub blob links keyed off the current commit SHA at build, so links remain valid for the deployed build even after files move on `main`. |
| Adding a "presentation mode" tempts feature creep (speaker notes, remote control, etc.). | `05-presentation-lane.md` ships the minimal slideshow only — keyboard nav + fullscreen + progress bar. Speaker notes & remote control are explicitly deferred. |
| The lane could expose pre-publication research content the candidate doesn't want visible. | `/about/research` content is hand-curated, not auto-pulled from `Plans/`. The candidate sees a PR diff for every word before it ships. |

## Methodology

Each lane doc follows the same shape so it can be handed to a single Codex/Claude-Code session:

- **Goal** — what done looks like.
- **Why now** — preconditions + what unlocks.
- **Sources** — links to existing files the lane depends on.
- **Sessions** — long-horizon prompts sized for one model run.
- **Verification** — exact commands to confirm done.
- **Done criteria** — checklist to tick.

## Sources

- `README.md`, `AGENTS.md`, `CONTRIBUTING.md`
- `docs/` (all files)
- `audits/00-overview.md`, `audits/99-master-todo.md`, `audits/13-codex-parity-supplement.md`
- `Codex-audits/00-audit-index.md`, `Codex-audits/MASTER_TODO.md`
- `Plans/Unified-Audit-Plan-2026-05-17/00-README.md` (structural template for this folder)
- `Plans/post-audit-plan.md`
- `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/s.$slug.tsx`
- `src/surveys/phase-1.ts`, `src/surveys/phase-3.ts`, `src/surveys/consent.ts`
- `src/lib/i18n.ts` (for the `UI` dict + `pickText` + `useLang` patterns this plan extends)
