# 正轨纠偏 — 步骤 2：系统化影响分析（Checklist 摘要）

日期：2025-10-21

## Section 1 — 触发与背景
- 触发故事：Story 1.6（最小可见面板）、Story 1.7（运维仪表盘）。
- 核心问题：缺少将“aggregator-go → NATS → ws-gateway → SharedWorker → 最小面板（UI）→ 观测”贯通的可运行 demo / 编排，现有组件分散存在但未形成端到端路径。
- 证据：
  - ws-gateway 提供 `docker-compose.yml` 与 `scripts/demo-e2e.sh`，但仅覆盖 NATS + gateway 与内部发布脚本；未联通 UI（apps/ui）与 aggregator-go（services/aggregator-go）。
  - apps/ui 存在 SharedWorker demo 与 e2e 测试，但默认 demo server 未配置连接 gateway 与 NATS。
  - services/aggregator-go 为最小 metrics stub，未输出 xy.md.*（33ms 增量/快照）至 NATS。
  - 根目录缺少统一 orchestration（Compose/Make）与 CI e2e 任务验证跨服务路径。
- 状态：Done

## Section 2 — Epic 影响
- Epic 1 目标仍成立；需加入“端到端集成切片”的显式交付与验证。
- 建议：
  - 调整 Story 1.6 交付定义：包含“最小端到端 demo（UI 页面可见）”。
  - 在 1.6 与 1.7 之间插入/细化一条“E2E Integration Skeleton”任务（或 1.6 补充子任务）。
- 状态：Action-needed

## Section 3 — 文档/制品影响
- PRD：无需大改（MVP 对端到端证明已有要求）。
- Solution Architecture：补充“Dev Orchestration”图与本地/CI 跑法。
- Tech Spec（Epic 1）：新增“root-level compose + smoke tests + dashboards 最小化”章节与验收标准。
- UI/UX：最小面板的数据接入路径与降级指示需明确。
- IaC/CI：增加 GitHub Actions/Playwright job 做跨服务 e2e。
- 状态：Action-needed

## Section 4 — 路径选择
- Option 1（推荐）：在当前计划内直接补充集成层与验证脚本；不回滚。
- Option 2：回退或冻结部分实现，集中做集成（不推荐）。
- Option 3：MVP 范围收缩（当前不需要）。
- 选型：Option 1（Direct Adjustment）。
- 状态：Done

## Section 5 — 提案组件
- Issue Summary：已草拟。
- Impact & Adjustments：见上。
- Recommended Approach：Option 1。
- MVP 影响：无收缩，仅明确“可运行 demo + 仪表”门槛。
- Handoff：开发团队直接实施，PO/SM 协助 backlog 调整。
- 状态：Action-needed（待用户确认）

## 待确认问题
1) 交互模式选择：Incremental（推荐）或 Batch？
2) 可接受的“最小可见”范围：是否以“单组 Top‑K 列表 + 速率/时延 2 指标”作为最小面板？
3) 本地运行偏好：是否必须纯 Compose 一把梭（不装 protos 工具链）？
4) CI 资源：是否允许在 PR 上启用 matrix（node/go/ui）+ e2e（Playwright + ws-gateway + NATS）？

