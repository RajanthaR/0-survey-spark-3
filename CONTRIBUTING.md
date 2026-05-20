# Contributing

## Runtime

Use Bun 1.3.14 and Node 24.15.0. `bun.lock` is the source of truth; do not add
`pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock`.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run format:check
bun run lint -- --max-warnings 0
bun run deploy:preflight:static
bun run test
bun run build
```

## Commits and PRs

- Use focused branches. Prefer `codex/<short-topic>` for Codex work and clear
  topic prefixes such as `docs/`, `ops/`, `security/`, `db/`, `fix/`, or
  `feat/` when creating human-authored branches.
- Use conventional commit-style prefixes: `feat`, `fix`, `perf`, `refactor`,
  `docs`, `test`, `security`, `i18n`, `db`, `ops`, or `chore`.
- Run the full check sequence before opening or updating a PR.
- Treat tests as contracts. Do not skip, delete, or weaken tests unless the PR
  explicitly replaces the covered behavior.
- Keep generated files marked as generated; do not hand-edit
  `src/integrations/supabase/types.ts` or `src/routeTree.gen.ts`.
- Review i18n, accessibility, security, and export behavior when touching
  respondent or admin workflows.
- Review performance budgets and bundle shape when changing route imports,
  survey media, charting, or admin/export dependencies.
- Review security headers, server-only imports, service-role access, and PII in
  logs when touching server functions, middleware, exports, or deployment code.

## Project Plans And Audits

The audit plan under `Plans/Unified-Audit-Plan-2026-05-17/` and the source
audits under `audits/` explain why many guardrails exist. Reference the
relevant audit item in PR descriptions when closing planned work.

## Local Hooks

Husky runs `bun run lint-staged` before commits. The hook checks staged
TypeScript with ESLint and checks staged app/docs files with Prettier.

## GitHub Settings

Enable branch protection on `main` and require the PR workflow checks before
merge. If CodeRabbit or another review app is installed, configure it as a
required PR-level review signal in GitHub settings.
