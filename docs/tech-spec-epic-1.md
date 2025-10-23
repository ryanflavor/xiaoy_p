# Technical Specification: 基础设施与单连接骨架（Foundation & Single-Connection）

Date: 2025-10-20
Author: ryan
Epic ID: 1
Status: Draft

---

## Overview

本 Epic 聚焦“单连接一致性 + 稳态可观测”的底座能力，直接支撑 PRD（2025-10-20）中的核心目标：在 4–5 个窗口并开与峰值 ~4k tick/s 情况下，保持 UI ≥ 60 FPS，端到端 P95 < 120ms、P99 < 180ms，并提供可降级与断线 ≤ 3s 恢复能力（见 PRD FR001–FR008、FR013–FR015）。方案依据《Solution Architecture》（2025-10-20）：以 NATS/JetStream 为消息中枢，聚合器（Go）按“33ms 增量 + 2–5s 快照”输出到 xy.md.*，经 WS 网关（Node）单连接转发至前端 SharedWorker 扇出，前端进行批量合并/去重与增量绘制。

本 Epic 的交付形成后续 UI/策略模块的稳定地基：统一契约（Protobuf + buf 兼容检查）、最小可观测闭环（Prometheus 指标 + 慢消费者保护）、以及权限与安全基线（NATS Accounts、JWT/NKey、主题级 ACL、TLS）。

## Objectives and Scope

In-Scope（本 Epic 完成）：
- WS 网关最小链路（NATS → WS 单连接；TLS + JWT/NKey；主题 ACL）。
- SharedWorker 单连接扇出骨架：16–33ms 批量合并与去重；断线指数回退与并发上限。
- Aggregator-Go 33ms 增量/2–5s 快照通道与分片策略；快照重建 ≤ 1s。
- 契约与代码生成：Protobuf + buf（append-only 检查）；TS/Go/Py 生成基线。
- 可观测与降级：关键指标（连接数、速率、慢消费者、端到端延迟）与 3 级降级钩子。

Out-of-Scope（后续 Epic/Story 交付）：
- 业务面板细节与策略执行流程。
- 多租户/多地域与复杂合规策略。
- 高阶回放/审计 UI 与运营仪表进一步细化。

## System Architecture Alignment

对齐《Solution Architecture》的关键组件与约束如下：
- Components：
  - services/ws-gateway（Node 22.11）：单连接转发、鉴权、指标导出。
  - services/aggregator-go（Go 1.22）：增量/快照生产、去重与限速、分片输出 xy.md.*。
  - packages/contracts：Protobuf 契约与 buf 兼容策略，生成 TS/Go/Py 代码。
  - apps/ui（SharedWorker 骨架）：单连接扇出与跨标签一致性。
- Constraints：
  - 单连接一致性（SharedWorker 扇出）；仅追加契约（append-only）；
  - JetStream 审计/回放与慢消费者保护；
  - 安全边界：NATS Accounts、主题级 ACL、TLS、短期 JWT。

## Detailed Design

### Services and Modules

- ws-gateway（Node 22.11；Owner: TBD）
  - 职责：终止浏览器单连接 WebSocket；将订阅/取消订阅与消息转发至 NATS；暴露 /healthz 与 /metrics；慢消费者防护与限速。
  - 输入：浏览器 WS 消息（订阅、心跳）、NATS 主题 xy.md.*。
  - 输出：浏览器 WS 增量/快照消息；Prometheus 指标。

- aggregator-go（Go 1.22；Owner: TBD）
  - 职责：从 xy.src.* 与 xy.ref.* 摄入；按 33ms 产生增量、2–5s 产生快照；去重/乱序修正/限速与分片；输出至 xy.md.*；暴露指标。
  - 输入：xy.src.tick.{venue}.{symbol}，xy.ref.contract.{venue}.{symbol}
  - 输出：xy.md.tick.{group}[.{shard}]，xy.md.snapshot.{group}

- contracts（Protobuf + buf；Owner: TBD）
  - 职责：定义增量/快照契约与版本策略；生成 TS/Go/Py 代码；CI 仅追加兼容检查。
  - 输入：.proto/.buf 版本与规则。
  - 输出：生成代码包与兼容性报告。

- apps/ui（SharedWorker 骨架；Owner: TBD）
  - 职责：维护单条 WS；以 BroadcastChannel/MessagePort 向多标签页扇出；16–33ms 批处理去重；断线指数回退；指标采集。
  - 输入：ws-gateway 消息流；
  - 输出：页面事件与渲染数据；指标上报。

### Data Models and Contracts

- md.tick（增量）
  - 字段：ts_exchange、ts_arrival、seq、last、bid/ask[depth]、vol、oi、flags、source。
  - 语义：按 group/shard 聚合后的最小必要变更集；允许小窗内重排与去重。

- md.snapshot（快照）
  - 字段：版本与序列、窗口状态、Top‑K/筛选投影；
  - 语义：与增量同构，可在断线或版本不一致时 ≤1s 重建。

- session / feature_flags（管理/可选）
  - 字段：会话标识、心跳、特性开关。
  - 语义：仅用于健康与灰度，不参与交易路径。

### APIs and Interfaces

- NATS Subjects
  - 摄入：xy.src.tick.{venue}.{symbol}；xy.ref.contract.{venue}.{symbol}
  - 产出：xy.md.tick.{group}[.{shard}]；xy.md.snapshot.{group}
  - 管理：xy.exec.health

- HTTP（网关/服务）
  - /healthz（liveness/readiness）、/metrics（Prometheus）、/admin/feature-flags（受限访问）

### Workflows and Sequencing

1) aggregator-go 摄入 xy.src.* / xy.ref.* → 去重/修正/分片 → 输出 xy.md.*（33ms/2–5s）
2) ws-gateway 订阅 xy.md.* → 单连接 WS 推送至浏览器 → 慢消费者保护
3) SharedWorker 合并/去重（16–33ms）→ 扇出到多标签页 → UI 增量绘制

## Non-Functional Requirements

### Performance
目标与度量（与 PRD/NFR 对齐）：
- UI 帧时：rAF 帧 p95 ≤ 16.7ms、p99 ≤ 25ms；关键面板每帧渲染预算 ≤ 8ms。
- 端到端（adapter→aggregator→WS→UI）：P95 < 120ms、P99 < 180ms。
- 重建：断线或版本不一致触发快照重建 ≤ 1s；恢复到既有订阅 ≤ 3s。
- SharedWorker 批处理：16–33ms 周期；避免超预算抖动（分片与优先级控制）。

### Security
控制与策略：
- NATS Accounts + JWT/NKey 鉴权；短期令牌；TLS 强制。
- 主题级 ACL：仅允许 xy.* 前缀的最小权限集；审计订阅/发布行为。
- 管理面受限：/admin/feature-flags 仅对受信主体开放；日志敏感字段脱敏。

### Reliability/Availability
稳态与降级：
- 慢消费者保护：背压阈值与丢弃策略（优先保证高价值面板）。
- JetStream 流保留策略：xy.src.* 与 xy.ref.* 保留；回放与基准测试通道可用。
- 网关灰度发布与健康门；异常自动降级三级：采样降频→字段裁剪→面板停更（含恢复条件）。

### Observability
指标与信号：
- 网关：ws_active、ws_msgs_rate、slow_consumers、nats_req_latency、backpressure_events。
- 聚合器：src_ingest_rate、src_gap、reorder_count、ticks_out、snapshots_out。
- 端到端：p50/p95/p99 延迟、重建次数与耗时、带宽使用。
日志与追踪：结构化日志；关键链路追踪（可选 OpenTelemetry）。

## Dependencies and Integrations

- Runtime/Tooling
  - Node.js 22.11.0 LTS（repo engines）+ pnpm 9.12.2
  - Go 1.22（services/gocore/go.mod）
  - Python 3.13（packages/pycore/pyproject.toml）
  - protoc 28.2、buf 1.35.0
- Libraries（代表性）
  - 前端/网关：ws 8.18.3、nats.js 2.28.2、vitest 2.1.4
  - Go：nats.go 1.46.0、prometheus client_golang 1.23.2
  - Python：nats-py 2.11.0、prometheus-client 0.20.0（用于后续 AlgoExec 服务）
- Platform
  - NATS Server 2.12.1（JetStream 启用）
  - Prometheus/Grafana/Loki/Tempo（可观测栈，按《Solution Architecture》建议）

约束与版本策略：
- 合同仓库实施“仅追加”兼容策略；CI 执行 buf 兼容检查。
- Node/Go/Python 版本在 CI 中锁定并通过容器/镜像统一；不允许在生产中使用未列入白名单的次要版本。

## Acceptance Criteria (Authoritative)

1) 单连接一致性：浏览器仅建立 1 条 WS；切换/新开标签不产生额外连接；断线指数回退与并发上限生效。
2) 扇出与批处理：SharedWorker 以 16–33ms 周期合并/去重广播；在 4–5 窗口并开时不超过渲染预算（每帧 ≤ 8ms）。
3) 聚合通道：aggregator-go 稳定输出 33ms 增量与 2–5s 快照；任一点断线触发快照重建 ≤ 1s。
4) 端到端时延：adapter→aggregator→WS→UI 渲染 P95 < 120ms、P99 < 180ms（交易时段基线）。
5) 安全与权限：NATS Accounts + JWT/NKey 强制；主题级 ACL 覆盖 xy.* 且最小权限；未授权主题被拒绝并审计。
6) 可观测：/metrics 暴露 ws_active、ws_msgs_rate、slow_consumers、nats_req_latency、ticks_out、snapshots_out；日志结构化且含错误码。
7) 慢消费者保护：达到阈值时触发降级（采样降频/字段裁剪/停更），并记录事件与恢复条件。
8) 契约治理：Protobuf 契约变更经 buf 兼容检查（append-only）；生成 TS/Go/Py 代码与样例通过。
9) 恢复与一致性：断线或版本不一致场景下 ≤ 3s 恢复至原订阅与视图；不一致自动请求快照。
10) 管理面约束：/admin/feature-flags 仅对受信主体开放；审计所有管理变更。

## Traceability Mapping

| AC | Spec Section | Components | Interfaces | Verification |
| -- | ------------- | --------- | --------- | ----------- |
| 1 | Detailed Design → Services/WS 网关；Workflows | ws-gateway, SharedWorker | WS | e2e: single-connection fanout |
| 2 | Detailed Design → Workflows；NFR/Performance | SharedWorker | WS | perf: worker batch budget |
| 3 | Detailed Design → Aggregator；APIs | aggregator-go | xy.src.*, xy.md.* | perf: tick/snapshot simulator |
| 4 | NFR/Performance | 全链路 | WS + NATS | e2e: latency probe & dashboards |
| 5 | NFR/Security | NATS + ws-gateway | JWT/NKey + ACL | sec: ACL negative/positive cases |
| 6 | NFR/Observability | ws-gateway, aggregator-go | /metrics | obs: prometheus scrape |
| 7 | NFR/Reliability | ws-gateway | WS | chaos: slow consumer & degrade |
| 8 | Data Models/Contracts | contracts | buf | ci: buf breaking-check pipeline |
| 9 | Workflows + NFR/Reliability | ws-gateway, SharedWorker | WS + xy.md.* | e2e: disconnect/rebuild tests |
| 10 | Security + Admin | ws-gateway | HTTP admin | sec: RBAC/admin audit tests |

## Risks, Assumptions, Open Questions

- Risk：UI 慢消费者导致背压扩散 → 网关限流与优先级丢弃；触发 3 级降级并提示用户（记录事件）。
- Risk：聚合器分片/乱序修正策略不当 → 压测与回放基准验证；出现 gap 时自动告警。
- Risk：契约破坏性变更 → buf 兼容检查强制；未知字段容忍并打点。
- Assumption：上游行情源稳定、时钟同步在容忍范围内；网络带宽满足基线门槛。
- Question：是否需要多地域冗余与跨集群订阅（Level 4 才引入）。

## Test Strategy Summary
测试金字塔：
- Unit：ws-gateway 订阅/转发/限流；contracts 代码生成与未知字段容忍；SharedWorker 扇出与批处理逻辑。
- Integration：NATS RPC/流主题连通；aggregator-go 输出与分片；/metrics 暴露与采集。
- E2E：多窗口单连接、断线恢复（≤3s）、场景切换不抖动；权限/ACL 正反用例。
- Performance：tick 注入压测（33ms 增量/2–5s 快照）；UI FPS 与端到端延迟仪表板对比阈值。

---

### Demo Orchestration（新增）

- 根级编排：`compose.demo.yml` 提供一键拉起 dev 组合：`nats`、`gateway`、`aggregator`、`ui`，可选 `prometheus`、`publisher`。
- 关键端口：NATS 4222、WS 网关 8080、Aggregator 8090、UI Demo 5174、Prometheus 9090。
- 安全开关（dev）：`JWT_PUBLIC_KEY=/app/.demo_pub.pem`、`ALLOWED_ORIGINS=*`（仅限 dev/CI；生产需白名单）。
- 快速命令：
  - `npm run demo:up` / `npm run demo:down`
  - `npm run demo:publisher`（启用 demo 发布）
  - `npm run demo:observe`（启用 Prometheus 抓取）
  - `npm run demo:smoke`（健康检查 + 单次订阅与转发验证）

### E2E Strategy（新增）

- 正路径：UI（SharedWorker）→ ws-gateway → NATS → demo-publisher（周期消息）闭环；页面可见“demo-msg-*”。
- 负路径：未授权主题发布应被拒绝并产生指标/日志计数（后续在 CI 中加入）。
- 指标抓取：Prometheus 抓取 `gateway:8080/metrics` 与 `aggregator:8090/metrics`；最小字段集 `xy_ws_messages_forwarded_total`、`ws_msgs_rate`、`ticks_out`。
- Playwright：`apps/ui/e2e/demo-compose.spec.ts` 验证“单连接+扇出+收包+指标非空”。

### Acceptance Mapping（更新）

| 交付 | 验证 | 工具/文件 |
|---|---|---|
| 1.6a 集成骨架 | 一键跑通 + e2e 通过 | compose.demo.yml、apps/ui/e2e/demo-compose.spec.ts |
| 1.6 最小面板 | UI 接入与两项指标可见 | apps/ui/demo、SharedWorker manager |
| 1.7 运维仪表 | Prom 抓取 + 字段字典 | infra/prometheus/prometheus.yml、docs/observability/field-dictionary.md |
