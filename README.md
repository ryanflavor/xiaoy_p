# xiaoy Monorepo Baseline

This repository uses npm workspaces to organize apps and packages.

## Scripts

- `npm run lint` — minimal lint checks (whitespace/tabs)
- `npm run lint:eslint` — ESLint rules (JS/TS)
- `npm run format:check` — formatting checks per .editorconfig
- `npm run format:check:prettier` — Prettier check
- `npm test` — runs Node.js built-in test runner across workspaces
- `npm run test:cov` — Node tests with c8 coverage
- `npm run test:vitest` — run vitest across workspaces
- `npm run build` — aggregates workspace build scripts if present

## CI

GitHub Actions workflow `.github/workflows/ci.yml` runs on pushes and PRs to `main`.
- Jobs:
  - `build` (Node 22): lint, format checks, coverage, vitest, unit tests
  - `python` (uv+pytest): runs tests in `packages/pycore`
  - `go` (1.22): runs `go test` in `services/gocore`
