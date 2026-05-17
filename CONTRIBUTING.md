# Contributing

## Runtime

Use Bun 1.3.14 and Node 24.15.0. `bun.lock` is the source of truth; do not add
`pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock`.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run format:check
bun run lint -- --max-warnings 0
bun run test
bun run build
```

## Commits and PRs

- Keep branches focused on one fix or feature.
- Run the full check sequence before opening a PR.
- Keep generated files marked as generated; do not hand-edit
  `src/integrations/supabase/types.ts` or `src/routeTree.gen.ts`.
- Review i18n, accessibility, security, and export behavior when touching
  respondent or admin workflows.

## Local Hooks

Husky runs `bun run lint-staged` before commits. The hook checks staged
TypeScript with ESLint and checks staged app/docs files with Prettier.

## GitHub Settings

Enable branch protection on `main` and require the PR workflow checks before
merge. If CodeRabbit or another review app is installed, configure it as a
required PR-level review signal in GitHub settings.
