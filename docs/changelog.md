# Changelog

## 2025-10-21 — Epic 1 Integration Skeleton (internal milestone)

- Added root‑level compose for demo (`compose.demo.yml`) and helper scripts (`tools/demo-smoke.sh`, npm `demo:*`).
- Added Prometheus minimal scrape config (`infra/prometheus/prometheus.yml`).
- Added Compose‑based Playwright E2E (`apps/ui/e2e/demo-compose.spec.ts`).
- Added CI gate: `.github/workflows/ci-e2e.yml` (runs compose demo + Playwright).
- Documentation updates:
  - `docs/tech-spec-epic-1.md` — Demo Orchestration, E2E Strategy, Acceptance Mapping
  - `docs/solution-architecture.md` — Dev run view & runbook
  - `docs/observability/field-dictionary.md` — Minimal metric set
- Notes:
  - `1.6a 集成骨架` is an implementation checkpoint under Story 1.6; numbering in `docs/epics.md` remains unchanged.

