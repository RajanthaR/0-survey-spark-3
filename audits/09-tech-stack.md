# Audit 09 — Tech stack & dependencies

## Snapshot

| Layer | Stack |
| --- | --- |
| UI | React 19.2, Tailwind v4, Radix UI, Framer Motion 12, Lucide |
| Forms / validation | react-hook-form 7.71, zod 3.24 |
| Routing | TanStack Router 1.168 + TanStack Start 1.167 |
| Build | Vite 7.3, Cloudflare Vite Plugin 1.25 |
| Backend | Supabase JS 2.105, server fns on Cloudflare Workers |
| Tests | Vitest 4.1 (pre-release line), Playwright 1.60 |
| Lint | ESLint 9.32, typescript-eslint 8.56, prettier 3.7 |
| Misc | xlsx 0.18, fflate 0.8, jspdf 4.2, sonner 2.0, recharts 2.15 |

## Strengths

- Modern major versions everywhere — React 19, Vite 7, Tailwind v4.
- Sensible split between `dependencies` and `devDependencies`.
- `sideEffects: false` enables tree-shaking.
- `wrangler.jsonc` keeps Worker config minimal + `compatibility_flags: ["nodejs_compat"]` is current.

## Findings

### St-1 — TanStack Start version drift _(medium)_

`@tanstack/react-router@^1.168.25` + `@tanstack/router-plugin@^1.167.28` + `@tanstack/react-start@^1.167.50` are on three different patch lines. Pin them to the same minor.

### St-2 — `vitest@^4.1.6` is a pre-release line _(medium)_

Vitest 4 is still alpha/beta as of this audit. Several Vitest plugins do not support 4 yet. Pin to `vitest@^3.x` until 4 is stable, or document the pre-release decision in `Plans/post-audit-plan.md`.

### St-3 — Heavy deps that may be unused

- `canvas-confetti` (only loaded on the `done` stage; size 4 KB — keep).
- `embla-carousel-react`, `vaul`, `cmdk` — only used by shadcn defaults? Run `bun run knip` (or similar) to enumerate dead deps.
- `react-resizable-panels` — verify it's still referenced.
- `input-otp` — only relevant if 2FA is planned.
- `jspdf` — verify usage; if only for one admin export, lazy-import.

### St-4 — `xlsx` 0.18.5 has known vuln history

Audit with `npm audit --omit=dev`. Consider migrating to `exceljs` for streaming + better CVE posture.

### St-5 — `@tanstack/react-query` listed but use is sparse

If only used in 1–2 hooks, consider removing in favour of pre-loaders the router already provides.

### St-6 — No lockfile committed for Bun ≠ npm

`.gitignore` excludes `bun.lock`. CI uses `bun install --frozen-lockfile` in workflows — but if no lockfile is committed, that command fails. Audit: either commit `bun.lock` or remove the `--frozen-lockfile` flag.

### St-7 — Deploy target documentation thin

`wrangler.jsonc` shows the Worker config; `docs/DEPLOYMENT.md` covers env vars but not:
- The CF Pages vs Worker decision.
- `compatibility_date` rationale.
- Routing for the SW (`/sw.js`).
- Cache headers for the SW (must be no-cache or short max-age to allow updates).

### St-8 — `scripts/smoke-ssr.mjs` is the only post-deploy gate

Add a Lighthouse / Playwright smoke step that exercises a real form submission against a staging env.

### St-9 — Type-check + lint scripts missing

`package.json` has `lint` but no `typecheck`. Add:
```json
"typecheck": "tsc --noEmit",
"lint:fix": "eslint . --fix"
```

### St-10 — `bun` is the default package manager but readme says `bun install`

Document a Node fallback for contributors who don't run Bun. Without it, the `bun: command not found` error is the first thing a new contributor sees.

## Suggested improvements

1. Pin all `@tanstack/*` versions to the same minor.
2. Downgrade Vitest to stable 3.x (or document the pre-release decision).
3. Run a dead-deps pass (knip or depcheck).
4. Migrate to `exceljs` (or assert `xlsx` is pinned to a clean version).
5. Commit `bun.lock` so CI `--frozen-lockfile` works.
6. Expand `docs/DEPLOYMENT.md` with SW cache, `compatibility_date`, and CF routing details.
7. Add `typecheck` + `lint:fix` scripts.
8. Document an `npm`/`pnpm` fallback in `README.md`.
