# Codex Desktop + GPT-5.5 Playbook

This plan is designed to be driven from the **Codex Desktop app** with the
**GPT-5.5** model (Apr 2026). The phases below assume the capabilities listed
here. If you are running on Claude Code / Cursor / a different agent, the
prompts still work but the **session size** and **verification loops** will
need to be smaller.

## What GPT-5.5 + Codex Desktop give us (Apr 2026)

- **400 K context in Codex** (1 M in API). Whole-module refactors fit in one prompt — `admin.tsx` (4 099 lines), `SurveyRunner.tsx` (877 lines), all related tests, the surveys, and `i18n.tsx` together total ≈ 35 K tokens. Plenty of headroom for inline tests + commit messages.
- **Long-horizon agentic coding.** Terminal-Bench 2.0 = 82.7 %, Expert-SWE = 73.1 %. Multi-step refactors that previously needed 3-4 prompt rounds now ship in one session.
- **Computer Use (macOS first).** The agent can drive the dev server, click through SI / TA flows, and screenshot mismatches. Use it for the UX / a11y / i18n phase verification.
- **In-app browser + `gpt-image-1.5`.** Useful for Lighthouse runs, axe-core scans, mobile viewport screenshots, contrast spot-checks.
- **Plugins (90+).** Three are particularly relevant here:
  - **CodeRabbit** — pre-merge code review on every PR.
  - **GitHub Issues** — convert each P0–P6 item into a tracked issue with the phase prompt as the body.
  - **CircleCI** — wire the new `pr.yml` workflow we land in P0.
- **Automations + memory.** Schedule the nightly Lighthouse / dependency audit. Memory remembers the resolutions to recurring questions ("Turnstile policy = fail-closed in prod", "primary PM = Bun", etc.).
- **Multi-terminal + summary pane.** Run `bun run test:watch` in one tab, `bun run dev` in another, `bun run typecheck` ad-hoc, while the agent owns a fourth.

## Codex Desktop session model

Each "Codex Session" in the phase docs maps to **one** prompt inside Codex
Desktop. A session has:

- A **scope sentence** ("Fix the `adminLoginGuard` lockout bug end-to-end").
- A **target file set** (paths the agent should read first).
- A **verification command sequence** (`bun run typecheck && bun run lint && bun run test ...`).
- A **commit budget** (1 PR per session unless explicitly grouped).

Sessions are sized so GPT-5.5 can complete them coherently. If a session
exceeds ~30 K tokens of source it should be split — the playbook flags those
explicitly.

### Recommended Codex profile

```
Model:    GPT-5.5 Thinking          # default; switch to Pro for deep refactors
Mode:     Long-horizon              # not Fast mode — correctness > latency
Plugins:  CodeRabbit, GitHub Issues, CircleCI
Memory:   ON   (Mac / non-EU)        # remembers project decisions
Sandbox:  Repo-only edits + run     # block network writes by default
Browser:  ON for verification only  # never let it open Supabase admin
```

For deep refactor sessions (the `admin.tsx` split), bump to **GPT-5.5 Pro**
and spend the extra cost — those sessions are a wrong-answer trap.

## Prompt patterns we will reuse

### Bug-fix prompt

```text
Goal: <one-sentence goal>.

Read these files before editing:
- <path:line-range>
- <path:line-range>

Constraints:
- Tests must stay or get stricter (no deletions, no skips).
- No new dependencies.
- One PR; commit after `bun run typecheck && bun run lint && bun run test <file>` pass.
- Open the PR with title "fix(<area>): <summary>" and body referencing
  audits/<file>:<finding-id>.

Verification:
1. `bun run typecheck` exits 0.
2. `bun run lint <file>` exits 0.
3. `bun run test <test-file>` exits 0.
4. CodeRabbit review has zero blocking comments.
```

### Refactor prompt

```text
Goal: Split <file> by <axis>. Behaviour must be identical.

Pre-work:
1. Run `bun run test` and capture which tests touch this file.
2. Generate a coverage report with `vitest --coverage`. If any leaf the
   refactor will move is uncovered, write the missing tests *first* and
   open them as a separate PR before the refactor.

Refactor:
- Extract per-module pure functions into `<new-path>`.
- Extract hooks into `<new-path>/hooks/use<Name>.ts`.
- Keep the public surface (default exports, route ids) identical.
- Use feature flags only if behaviour changes; otherwise no flags.

Verification:
1. `bun run typecheck && bun run lint && bun run test`.
2. Bundle size diff via `size-limit`. No regression > 1 %.
3. Manual spot-check: Computer Use opens / and /admin, takes screenshots,
   compares against pre-refactor screenshots in `Plans/Unified-Audit-Plan-2026-05-17/screenshots/`.
```

### Verification prompt (Computer Use)

```text
Goal: Verify the respondent flow in EN, SI, and TA.

Steps:
1. Run `bun run dev` in the active terminal.
2. Open http://localhost:5173/ in the in-app browser.
3. For each lang in [en, si, ta]:
   - Click the language toggle to <lang>.
   - Walk consent → first 3 questions → review → contact → done.
   - Screenshot each stage to Plans/Unified-Audit-Plan-2026-05-17/screenshots/<lang>/.
4. Compare against the pre-refactor screenshots in the same folder.
5. Report any DOM diff, focus diff, or font diff.

Stop conditions:
- Any screen reader announcement missing (use VoiceOver in Mac).
- Any control un-focusable.
- Any text overflowing on 320 px viewport.
```

## What to NEVER let the agent do

- Open Supabase admin / production console (memory entry: "no production writes").
- Bump major dependency versions (`vite@8`, `eslint@10`, `typescript@6`, `vitest@4` → `vitest@5`, etc.) outside the catalogue in `09-deferred-breaking.md`.
- Touch `db/schema.sql` without running `supabase db diff` first.
- Delete or skip tests as a workaround.
- Change `routeTree.gen.ts` by hand (re-generate via `tsr generate`).
- Disable ESLint rules without a comment + linked finding.

## Memory entries to set up

Set these in Codex Desktop **before** P0 so all phases benefit:

```
- "Primary package manager is Bun. If `bun: command not found`, run from
  `node ~/.nvm/versions/node/v24.14.1/bin/<bin>.js`."
- "Repository default branch is `main`. Every fix opens a PR; nothing
  pushes to main directly."
- "i18n triple is { en, si, ta }. Sinhala/Tamil literals only live in
  src/lib/i18n.tsx, src/lib/format.ts, src/lib/analytics-report-i18n.ts
  (after we add it to the allowlist), src/surveys/*, and tests."
- "Turnstile policy: prod must fail closed. Dev / preview may fail open.
  ALLOW_TURNSTILE_BYPASS=true is a preview-only escape hatch."
- "Resume token must not appear in the URL bar in P2+."
- "Generated files: src/integrations/supabase/types.ts and
  src/routeTree.gen.ts. Never hand-edit."
- "Audit IDs come from audits/01..13. Codex's parallel audits live in
  Codex-audits/. Both are read-only."
- "Production logs: no PII. Request IDs only."
```

## How to track progress

- One GitHub Issue per `10-master-todo.md` row, with a phase label.
- A burndown view filtered by phase label.
- A nightly Codex automation that re-runs the master TODO query and posts the diff to the team channel.
