# Codex Prompt Pack — survey-spark-3

Turnkey prompts for the unified audit plan. Each prompt is a **Codex plan
in itself** — paste the file contents into a Codex Desktop chat and the
agent should start coding immediately. Do **not** ask the agent to plan
first; the plan is already in the prompt.

## Folder map

```
codex-prompts/
├── README.md                       (this file)
├── 00-tooling/                     P0 — sequential, must finish before any P1
│   ├── 0.1-reproducible-install.md
│   ├── 0.2-prettier-baseline.md
│   ├── 0.3-ci-gate.md
│   └── 0.4-pre-commit-hook.md
├── 01-bugfixes/                    P1 — 7 parallel + 2 sequential
│   ├── wave-1-parallel.md          (1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.9)
│   ├── 1.8-exhaustive-deps.md      (after 1.3)
│   └── 1.6-inline-literals.md      (after 1.8)
├── 02-security/                    P2 — 5 parallel + 2 sequential
│   ├── wave-1-parallel.md          (2.1, 2.2, 2.4, 2.6, 2.7)
│   ├── 2.3-headers.md              (after 2.1)
│   └── 2.5-csp-nonce.md            (after 2.3)
├── 03-architecture/                P3 — gated by 3.1 then waves
│   ├── 3.1-screenshots.md
│   ├── wave-1-parallel.md          (3.3, 3.5, 3.7, 3.8)
│   ├── 3.2-admin-split.md          ⚠ GPT-5.5 Pro; XL
│   └── wave-2-parallel.md          (3.4, 3.6, after 3.2)
├── 04-perf/                        P4 — fully parallel after P3
│   └── wave-1-parallel.md          (4.1, 4.2, 4.3, 4.4, 4.5, 4.6)
├── 05-ux/                          P5 — wave + a11y sweep
│   ├── wave-1-parallel.md          (5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8)
│   └── 5.9-a11y-sweep.md           (final gate)
└── 06-deploy/                      P6 — fully parallel
    └── wave-1-parallel.md          (6.1 … 6.10)
```

## Visual map of prompt order

```
              P0 (sequential, 1 agent)
              ───────────────────────
              0.1 ─► 0.2 ─► 0.3 ─► 0.4
                                    │
                                    ▼
              P1 (1 batch, 7 agents) + 2 follow-ups (1 agent each)
              ────────────────────────────────────────────────────
              wave-1-parallel ┬─ 1.1  ┐
                              ├─ 1.2  │
                              ├─ 1.3  │  fire all 7 concurrently
                              ├─ 1.4  │
                              ├─ 1.5  │
                              ├─ 1.7  │
                              └─ 1.9  ┘
                                     │
                                     │  (1.3 lands)
                                     ▼
                              1.8-exhaustive-deps
                                     │
                                     │  (1.8 lands)
                                     ▼
                              1.6-inline-literals
                                     │
                                     ▼
              P2 (1 batch, 5 agents) + 2 follow-ups (1 agent each)
              ────────────────────────────────────────────────────
              wave-1-parallel ┬─ 2.1  ┐
                              ├─ 2.2  │
                              ├─ 2.4  │  (2.4 needs 1.2 done first)
                              ├─ 2.6  │
                              └─ 2.7  ┘
                                     │
                                     │  (2.1 lands; both touch start.ts)
                                     ▼
                              2.3-headers
                                     │
                                     │  (2.3 lands)
                                     ▼
                              2.5-csp-nonce
                                     │
                                     ▼
              P3 (gated, then waves)
              ──────────────────────
              3.1-screenshots         ← captures baseline, must run first
                       │
                       ▼
              wave-1-parallel ┬─ 3.3  ┐
                              ├─ 3.5  │  fire 4 concurrent
                              ├─ 3.7  │
                              └─ 3.8  ┘
                                     │  (wave 1 lands)
                                     ▼
                              3.2-admin-split  ⚠ XL, GPT-5.5 Pro, 1 agent
                                     │
                                     ▼
              wave-2-parallel ┬─ 3.4  ┐  fire 2 concurrent
                              └─ 3.6  ┘
                                     │
                                     ▼
              P4 (1 batch, 6 agents)
              ──────────────────────
              wave-1-parallel ┬─ 4.1  ┐
                              ├─ 4.2  │
                              ├─ 4.3  │  fire 6 concurrent
                              ├─ 4.4  │
                              ├─ 4.5  │
                              └─ 4.6  ┘
                                     │
                                     ▼
              P5 (1 batch, 8 agents) + 1 sweep
              ───────────────────────────────
              wave-1-parallel ┬─ 5.1  ┐
                              ├─ 5.2  │
                              ├─ 5.3  │
                              ├─ 5.4  │  fire 8 concurrent
                              ├─ 5.5  │  (5.1/5.2/5.3 mind __root.tsx)
                              ├─ 5.6  │
                              ├─ 5.7  │
                              └─ 5.8  ┘
                                     │
                                     ▼
                              5.9-a11y-sweep  (Computer Use + VoiceOver)
                                     │
                                     ▼
              P6 (1 batch, 10 agents)
              ──────────────────────
              wave-1-parallel ┬─ 6.1 ┐
                              ├─ 6.2 │
                              ├─ 6.3 │
                              ├─ 6.4 │
                              ├─ 6.5 │  fire 10 concurrent
                              ├─ 6.6 │
                              ├─ 6.7 │
                              ├─ 6.8 │
                              ├─ 6.9 │
                              └─ 6.10┘
                                     │
                                     ▼
                                   DONE
```

## How to use a single-prompt file

1. Open the file (e.g. `01-bugfixes/1.8-exhaustive-deps.md`).
2. Copy the entire body into a fresh Codex Desktop chat.
3. Confirm GPT-5.5 Thinking is selected (Pro for files marked ⚠).
4. The agent starts editing immediately. No re-planning step.
5. When the prompt's verification block exits 0 and the commit lands,
   the prompt is done.

## How to use a batch file (wave-1-parallel.md)

The batch file is a **launchpad**, not a single prompt. Each `## Prompt N.M`
section is one independent unit of work. Recommended flow:

1. Open the batch file.
2. Spawn one Codex agent per prompt section.
   - Codex Desktop: use the "New background task" / "+" affordance to
     open additional concurrent agents in the same project.
   - For each agent, copy **only** that section's body (everything from
     `## Prompt N.M` to the next `---`).
3. Each agent works in its own branch + PR.
4. When all agents in a wave have landed (CI green, merged), proceed to
   the next file in the order above.

If you only have one agent available, treat the batch file as a
sequential to-do list and run them one at a time — the order inside a
batch file is non-essential.

## Conventions used in every prompt

Every prompt starts with this header block (so Codex never re-plans):

```
ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first. Do not
      summarise the codebase. Start with step 1 immediately.
SCOPE: One PR. No scope creep. If a step expands beyond the listed
       files, STOP and report.
```

Then each prompt has:

- **TODO** — numbered, deterministic steps.
- **Files to read first** — surgical paths the agent should load.
- **Edits** — explicit, what to change and where.
- **Tests** — what to write or update; never delete.
- **Verification** — exact shell commands; all must exit 0.
- **Commit + PR** — branch name, commit subject, PR body.
- **Stop conditions** — when to escalate to the human.

## Branch & PR naming

```
fix/<area>-<short-slug>      (Phase 1)
security/<area>-<short-slug> (Phase 2)
refactor/<area>-<short-slug> (Phase 3)
perf/<area>-<short-slug>     (Phase 4)
ux/<area>-<short-slug>       (Phase 5)
docs/<area>-<short-slug>     (Phase 6 docs)
ops/<area>-<short-slug>      (Phase 6 ops)
```

Every PR title:
```
<type>(<area>): <imperative summary>  [<prompt-id>]
```

Every PR body includes:
```
Plan ref: Plans/Unified-Audit-Plan-2026-05-17/<phase-file>.md
Audit ref: audits/<file>.md <finding-id>
Prompt: codex-prompts/<phase>/<file>.md
```

## Stop / escalate rules (apply to every prompt)

The agent must stop and report back to the human if any of the
following hold:

- A test goes red that wasn't red before.
- `bun run typecheck` reports new errors outside the prompt's scope.
- An edit would require a major dependency upgrade.
- The diff exceeds 800 lines for non-XL prompts (XL prompts say so).
- The change requires touching `db/schema.sql` without first running
  `supabase db diff`.
- The change would touch a file marked `linguist-generated=true`.
- More than 30 minutes of wall-clock work has elapsed without progress.
```
