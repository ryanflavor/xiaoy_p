# Sprint Change Proposal — Epic 1 集成骨架与最小可见

日期：2025-10-21
作者：Winston（Architect）

## 1. Issue Summary
- 触发：在 1.6～1.7 阶段发现缺少“可运行的端到端 demo”，无法一次性验证 NATS→WS 网关→SharedWorker 扇出→最小面板→观测的闭环。
- 证据：组件分别存在（ws-gateway Compose、UI SharedWorker demo、aggregator-go stub、metrics 端点），但缺少根级 orchestration、消息源与 CI e2e。

## 2. Impact Analysis
- Epic 影响：目标不变，但需把“E2E 集成切片”作为显式交付。
- Story 影响：
  - 1.6：补充“可运行 demo + e2e 校验”。
  - 1.7：聚焦核心指标与最小仪表；与 1.6 共用 compose。
  - 新增 1.I：E2E Integration Skeleton（或作为 1.6 子任务）。
- Artifact 影响：
  - Tech Spec/Epic 1：新增 Demo Orchestration 与 E2E 策略章节。
  - Solution Architecture：补充 Dev 运行视图。
  - CI/CD：新增 `ci-e2e.yml`。

## 3. Recommended Approach（Option 1: Direct Adjustment）
- 建立 root 级 `compose.demo.yml` 与 `Makefile`/`npm scripts`；复用 gateway 的 demo 资产；
- 引入 `demo-publisher`（容器化 Node/Go）发布 `xy.md.tick.demo`，或扩展 aggregator-go 在 dev 模式输出 demo 流；
- apps/ui/demo 连接 ws-gateway，展示 Top‑K 列表与 2 个核心指标；
- Prometheus 最小抓取（可选 Grafana 预置 Dashboard）；
- CI 增加 demo-e2e 阶段，跑 Playwright 用例并上传报告。

效益：最短路径验证“单连接/扇出/观测”三件套，降低后续 UI/策略模块不确定性。
风险：demo 安全开关需隔离（JWKS/TLS/ACL 的 dev/ci 配置），避免误入生产。

## 4. Detailed Change Proposals
- 见 `step-3-proposals.md`（A–F）。

## 5. Implementation Handoff
- 变更级别：Moderate（需要 backlog 微调与跨组件串接，但无需产品范围重排）。
- 接收方与职责：
  - 开发团队：实现 compose、demo-publisher、UI 接入、e2e。
  - PO/SM：更新 Story 1.6/1.7 的验收标准与任务；必要时加入 1.I。
  - 架构：更新 Tech Spec 与架构视图，审查 CI 门禁。
- 成功标准：
  - 本地 `make demo-smoke` 一次通过；
  - CI PR 上 demo-e2e 通过并产出报告；
  - `/metrics` 指标非空；UI 可见消息与 2 个指标；
  - 负路径 ACL 拒绝用例计数出现。

