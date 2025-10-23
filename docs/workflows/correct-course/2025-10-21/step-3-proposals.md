# 正轨纠偏 — 步骤 3：具体变更提案（Old → New）

日期：2025-10-21

## A. Story 1.6（最小可见面板）

Section: Acceptance Criteria / Tasks

OLD（摘录）：
- 最小面板占位，展示占位列表/图表。
- 连接管线由后续故事完善。

NEW（建议）：
- 最小面板接入“单连接 SharedWorker”并通过 ws-gateway 连接本地 NATS；在 demo 页面可见“Top‑K 列表”和“端到端时延/消息速率”2 个指标。
- Root 级别提供 `compose.demo.yml` 一键拉起：nats + ws-gateway + demo-publisher（或 aggregator-go stub）+ ui-demo。
- 提供 `make demo-up/down/smoke`（或 `npm run demo:*`）命令，完成：
  a) 启动服务；b) 发布 2 条演示消息；c) 页面收到并显示；d) `/metrics` 抓取 1 次。
- E2E：Playwright 脚本验证“跨标签单连接 + 扇出 + 收到消息 + 指标不为空”。

Rationale：确保 Epic 1 的“端到端可见”与“单连接骨架”在 Story 1.6 即落地，降低后续串联风险。

---

## B. Story 1.7（运维仪表盘与 SLO/错误预算）

Section: Scope / Acceptance Criteria

OLD（摘录）：
- 初步的运维仪表盘与错误预算。

NEW（建议）：
- 聚焦 4 个核心指标的最小仪表：`ws_active`、`ws_msgs_rate`、`slow_consumers`、`p95_latency`（UI 端计算上报或代理统计）。
- 在 `compose.demo.yml` 中加入 Prometheus + Grafana 最小配置（可选：单文件采集 + 预置 Dashboard JSON）。
- 负路径验证：ACL 拒绝未授权主题，仪表出现计数（`slow_consumers` 或错误码日志）。

Rationale：把“可观测”做成可视化与阈值的最小闭环，服务后续策略模块。

---

## C. 新增（或细化）集成任务：Story 1.I（E2E Integration Skeleton）

Section: New Story

内容：
- 职责：把 aggregator-go（或 demo-publisher）→ NATS → ws-gateway → SharedWorker → UI demo → Prometheus 串联起来，作为“可运行骨架”。
- 交付物：`compose.demo.yml`、`Makefile`/`npm scripts`、`docs/demo-runbook.md`、CI job（`ci-e2e.yml`）。
- 验收：`make demo-smoke` 通过；CI 在 PR 上运行 e2e 并上传录屏/报告。

Rationale：将“集成”显式化为独立工件与门禁。

---

## D. Tech Spec（Epic 1）修改

Section: Dependencies and Integrations / Test Strategy

OLD：无“Dev Orchestration”与“Demo”章节。

NEW（建议增补小节）：
- Demo Orchestration：root compose、端口、环境变量、JWT/JWKS/TLS 开关、安全注意事项。
- E2E Strategy：从 demo publisher → UI 的闭环用例；负路径（ACL 拒绝、慢消费者降级）。

---

## E. Solution Architecture 修改

Section: Dev Environment

OLD：描述为 Dev=Compose、Prod=K8s（文字）。

NEW：增加“本地/CI 运行视图”图示：nats ↔ ws-gateway ↔ ui-demo（SharedWorker）↔ prometheus；外加 demo-publisher/aggregator-go。

---

## F. CI/CD 调整

- 新增 GitHub Actions workflow：`ci-e2e.yml`
  - Job 1（build）：lint + unit
  - Job 2（demo-e2e）：通过 compose 启动 nats/gateway/ui/demo-pub；运行 Playwright e2e；抓取 `/metrics`；保存报告与视频。
  - Job 3（contracts 可选）：buf breaking-check。

---

请逐项选择：Approve [a] / Edit [e] / Skip [s]

