## 正轨纠偏 — 步骤 5：批准与交接

日期：2025-10-21

### 批准
- 用户已批准完整 Sprint 变更提案进入实施（yes）。

### 变更级别
- Moderate：需要 backlog 微调与跨组件编排/e2e，但不影响 PRD 范围。

### 交接与职责
- 开发团队：
  - 落地 1.6a/1.6/1.7 的编排、UI 接入、demo‑publisher、最小 Prometheus、Playwright e2e
  - 维护 `compose.demo.yml` 与工具脚本，完成 smoke 与 CI 门禁
- PO/SM：
  - 更新 1.6/1.7 验收标准，纳入 1.6a；必要时调整迭代顺序
- 架构：
  - 更新 Tech Spec 与 Solution Architecture 文档，审查 CI 门禁与指标字典

### 输出工件（本步提交）
- 根级编排：`compose.demo.yml`
- Prom 抓取：`infra/prometheus/prometheus.yml`
- CI 门禁：`.github/workflows/ci-e2e.yml`
- E2E 用例：`apps/ui/e2e/demo-compose.spec.ts`
- 运行脚本：`tools/demo-smoke.sh`；npm scripts（package.json）
- 文档更新：`docs/tech-spec-epic-1.md`、`docs/solution-architecture.md`、`docs/observability/field-dictionary.md`

