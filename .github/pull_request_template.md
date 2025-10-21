## Summary

- Describe the change and affected components.
- Reference stories (e.g., `Story 1.6`, `Story 1.7`). If using the internal milestone label `1.6a 集成骨架`, note that it is an implementation checkpoint only; do not renumber stories in docs/epics.md.

## Scope

- [ ] Runtime / Services
- [ ] UI / SharedWorker
- [ ] Contracts
- [ ] Infra / CI / Observability
- [ ] Documentation only

## Epic 1 Gating (if touching 1.6/1.7)

- [ ] One‑click compose runs: `npm run demo:up`
- [ ] Smoke passes: `npm run demo:smoke`
- [ ] E2E (compose) passes locally: `npm run test:e2e -- apps/ui/e2e/demo-compose.spec.ts`
- [ ] CI job succeeded (attach link to `CI E2E (Compose Demo)` workflow)
- [ ] `/metrics` non‑empty (gateway) — includes `xy_ws_messages_forwarded_total` or `ws_msgs_rate`
- [ ] Optional negative path executed: ACL reject or slow consumer event observed

## Test Plan

1. Start: `npm run demo:up`
2. (Optional) Publisher: `npm run demo:publisher`
3. UI Demo: http://localhost:5174/demo/index.html (use token from `.demo_token.txt`)
4. Metrics: http://localhost:8080/metrics
5. Playwright: `npm run test:e2e -- apps/ui/e2e/demo-compose.spec.ts`

## Documentation

- [ ] Updated `docs/tech-spec-epic-1.md` or `docs/solution-architecture.md` as needed
- [ ] Updated `docs/observability/field-dictionary.md` if metrics changed

