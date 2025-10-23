# Contributing

1. Use feature branches; open PRs against `main`.
2. Ensure CI passes: `npm run lint`, `npm run format:check`, `npm test`.
3. Keep changes focused; update docs when needed.

## Epic 1 Integration Gating (Story 1.6/1.7)

When working on Epic 1 stories around the single‑connection + observability base:

- Run the demo compose locally: `npm run demo:up`
- Verify smoke: `npm run demo:smoke` (checks `/healthz` and `/metrics` and sends demo messages)
- Run E2E: `npm run test:e2e -- apps/ui/e2e/demo-compose.spec.ts`
- For PRs, the CI workflow `CI E2E (Compose Demo)` must succeed.

Internal milestone `1.6a 集成骨架` is used for implementation tracking only; do not renumber stories in `docs/epics.md`.
