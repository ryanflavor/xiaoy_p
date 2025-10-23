## 正轨纠偏 — 步骤 6：完成总结

日期：2025-10-21

### 概要
- 议题：1.6～1.7 阶段存在端到端集成缺口，缺少可运行 demo。
- 选择：Option 1（Direct Adjustment），加入 1.6a 集成骨架与最小观测闭环。

### 变更范围
- Story 1.6a（新增）：E2E Integration Skeleton（编排、脚本、e2e）
- Story 1.6（修订）：接入 SharedWorker → Gateway → NATS，并在页面显示 Top‑K 与 2 指标
- Story 1.7（细化）：最小运维仪表与错误预算（Prom 抓取 + 字段字典）

### Handoff
- Routed to：开发（实现/脚本/CI）、PO/SM（backlog 调整）、架构（文档/评审）

### 成功标准（执行后）
- 本地：`npm run demo:up` → `npm run demo:publisher` → 浏览器 /demo 收包可见 → `/metrics` 非空
- CI：`demo-compose.spec.ts` 通过并产出报告；`/healthz` 与 `/metrics` 校验通过

