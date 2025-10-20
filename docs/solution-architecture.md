# Solution Architecture Document

**Project:** xiaoy
**Date:** 2025-10-20
**Author:** ryan

## Executive Summary

本项目为 yueweioption_xiaoydb 的架构重构版：保留 Python/vn.py 交易 API 与策略执行能力，全面替换 UI 与通信层为 Web + NATS 架构。总体目标是在 4–5 窗口并开的高吞吐场景下，维持 UI ≥ 60 FPS 与端到端 P95 < 120ms，同时实现“仅追加”的契约治理、可观测与可降级、以及单连接一致性（SharedWorker 扇出）。

## 1. Technology Stack and Decisions

### 1.1 Technology and Library Decision Table

| Category         | Technology     | Version                | Justification                |
| ---------------- | -------------- | ---------------------- | ---------------------------- |
| Category | Technology | Version | Justification |
| -------- | ---------- | ------- | ------------- |
| Framework | React | 19.2.0 | 实时 UI 生态、并发能力、社区成熟 |
| Language | TypeScript | 5.9.2 | 强类型，配合契约代码生成 |
| Build | Vite | 7.1.4 | 开发/构建快速稳定 |
| Runtime (UI/Gateway) | Node.js | 22.11.0 LTS | 与工具链与 ws 兼容 |
| State Management | Zustand | 5.0.8 | 细粒度订阅，适合高频更新 |
| Styling | Tailwind CSS | 4.1.13 | 原子化样式降低复杂度 |
| Table | TanStack Table | 8.21.3 | Headless 表格/Datagrid |
| WS Gateway | ws | 8.18.3 | 轻量高性能 WebSocket |
| Messaging | NATS Server | 2.12.1 | 统一实时与请求‑应答；JetStream 审计 |
| NATS Client (Go) | nats.go | 1.46.0 | 聚合器/后台服务 |
| NATS Client (TS) | nats.js | 2.28.2 | 前端/网关 |
| NATS Client (Py) | nats‑py | 2.11.0 | AlgoExecution 服务 |
| Contracts | protoc | 28.2 | Protobuf 生成 |
| Contract Governance | buf | 1.35.0 | 契约仓库与兼容检查（append‑only） |
| Database | PostgreSQL | 16.6 | 统一存储；与审计流解耦 |
| ORM | SQLAlchemy | 2.0.36 | Python 持久化与迁移 |
| Migrations | Alembic | 1.13.2 | 结构化迁移策略 |
| Web API (Py) | FastAPI | 0.119.0 | 管理/健康/风控接口 |
| ASGI | uvicorn | 0.38.0 | 生产可用 ASGI |
| Observability (Go) | client_golang | 1.23.2 | Prometheus 指标 |
| Observability (Node) | prom‑client | 15.1.3 | Prometheus 指标 |
| Observability (Py) | prometheus‑client | 0.20.0 | Prometheus 指标 |
| Logging (Node) | pino | 9.9.4 | 低开销 JSON 日志 |
| Logging (Py) | loguru | 0.7.2 | 结构化日志（交易侧） |
| Analytics (Py) | pandas | 2.3.3 | 交易/回测表格计算 |
| Analytics (Py) | polars | 1.34.0 | 高性能批/流式计算（可选） |
| Indicators | TA‑Lib | 0.4.28 | 技术指标（算法侧） |
| Scheduler | APScheduler | 3.10.4 | 指标/任务节奏 |
| Package Manager (Py) | uv | 0.5.10 | 可复现构建（uv.lock） |
| Package Manager (JS) | pnpm | 9.12.2 | Monorepo 工作区 |

## 2. Application Architecture

### 2.1 Architecture Pattern

DDD（限界上下文）+ 事件驱动：以 MarketData、AccountsRisk、StrategySuggestion、AlgoExecution、Platform 为上下文；跨上下文只以契约与消息交互，禁止共享数据库。聚合器（Go）按 33ms 增量/2–5s 快照生产行情；WS 网关（Node）单连接转发到前端 SharedWorker 扇出；AlgoExecution（Python/vn.py）处理指令与回执。

### 2.2 Server-Side Rendering Strategy

CSR 为主；营销/静态页可预渲染。关键实时面板不做 SSR，避免水合成本。

### 2.3 Page Routing and Navigation

前端采用客户端路由（/login、/dashboard、/algo、/monitor、/settings）。导航分区：顶部主导航 + 左侧订阅/Top‑K 面板。

### 2.4 Data Fetching Approach

实时流：NATS → WS（SharedWorker 合并/去重 16–33ms 批次）；请求‑应答：NATS RPC（管理/指令），少量管理面走 HTTP(FastAPI)。前端使用 Fetch/WS 与 Gateway 交互。

### 2.5 Market Data Ingestion（新增）

目标：为 Aggregator‑Go 提供稳定、可观测、可回放的“原始行情”输入层。

组件与职责
- services/src-adapter‑vnpy（Python）：对接 vn.py 网关（CTP/CTP Mini/XTP/OES/SOPT…），将 Tick/合约元数据标准化并发布到 NATS。
- services/aggregator‑go（Go）：订阅原始源（xy.src.*），按 33ms 输出增量、2–5s 输出快照到 xy.md.*；执行去重/乱序修正/限速与分片。

主题与契约（NATS → Protobuf，append‑only）
- 原始 Tick：`xy.src.tick.{venue}.{symbol}`（ts_exchange, ts_arrival, last, bid/ask[depth], vol, oi, flags, source）
- 合约元数据：`xy.ref.contract.{venue}.{symbol}`
- 心跳：`xy.src.heartbeat.{venue}`

聚合器输入规则
- 乱序/重复：基于 ts_exchange 与序列号去重；允许小窗内重排。
- 背压：源适配器对每主题限速；聚合器对热点分片（group/shard）。
- 质量：缺口检测（gap）、异常值丢弃策略（flags）；指标暴露 src_ingest_rate、src_gap、reorder_count。

回放与模拟
- JetStream 保留 `XY_SRC_TICK`/`XY_SRC_REF` 流；回放主题 `xy.src-replay.*`；用于基准测试与故障复现。

安全与权限
- NATS 账户按“只写源（producer）/只读聚合器（consumer）”分离；源仅允许写 `xy.src.*`/`xy.ref.*`；聚合器仅读这些前缀并写 `xy.md.*`。

## 3. Data Architecture

### 3.1 Database Schema

核心表（PostgreSQL 16.6）
- accounts(id, name, type, created_at)
- positions(id, account_id, symbol, qty, avg_price, updated_at)
- risk_metrics(id, account_id, window, value_json, ts)
- orders(id, account_id, symbol, side, qty, price, status, corr_id, ts)
- audit(id, type, subject, payload_json, ts)

### 3.2 Data Models and Relationships

实体与关系
- Account 1‑N Position / RiskMetric / Order
- Order 与回执以 corr_id 关联（同时落 JetStream 审计流）

### 3.3 Data Migrations Strategy

Alembic 版本化迁移：每次契约或持久化变更先落 ADR → 迁移脚本 → Blue/Green 部署；读/写分离的临时影子表用于在线迁移。

## 4. API Design

### 4.1 API Structure

接口分层
- NATS Subjects（请求‑应答/流式）
- HTTP（FastAPI，管理与健康）
- WebSocket（UI 单连接）

### 4.2 API Routes

NATS Subjects（样例）
 - 请求‑应答：
  - xy.exec.order.place → 回执 xy.exec.order.result（corr_id）
  - xy.exec.order.cancel → 回执 xy.exec.order.ack
  - xy.exec.comb.action → 回执 xy.exec.comb.ack
  - xy.exec.algo.start|stop|resume → 回执 xy.exec.algo.ack
 - 流式：
  - xy.exec.events.order.*
 - xy.exec.events.trade.*
  - xy.exec.health
 - 市场与风险：
  - xy.src.tick.{venue}.{symbol}（源适配器）
  - xy.ref.contract.{venue}.{symbol}（合约元数据）
  - xy.md.tick.{group}（聚合器输出）
  - xy.md.snapshot.{group}（聚合器输出）
  - xy.risk.metrics.{accountId}
HTTP（管理）
- GET /healthz, /metrics（Prometheus）
- POST /admin/feature‑flags

### 4.3 Form Actions and Mutations

表单提交通过 NATS RPC（下单/参数更新），UI 侧以 React Hook Form 管理表单状态并做防抖与约束校验。

## 5. Authentication and Authorization

### 5.1 Auth Strategy

NATS Accounts + NKey/JWT；前端 JWT（HttpOnly Cookie）+ TLS；主题级 ACL 最小权限。

### 5.2 Session Management

基于 JWT 的短期会话；刷新令牌受控；断线自动重连并渐进回放必要快照。

### 5.3 Protected Routes

受保护路由：/dashboard, /algo, /monitor, /settings（登录态 + 权限检查）。

### 5.4 Role-Based Access Control

单一 persona（Trader）为主；后续可扩展 Admin/Observer 角色；权限以主题前缀与后端校验结合。

## 6. State Management

### 6.1 Server State

服务端状态：NATS/JetStream 流（行情、回执、审计）+ Postgres 读模型（账户/风险/订单）。

### 6.2 Client State

客户端状态：Zustand 切片（行情视图、订阅、Top‑K、表格分页）；与 SharedWorker 共享只读缓存。

### 6.3 Form State

React Hook Form + Zod 校验；提交走 NATS RPC。

### 6.4 Caching Strategy

前端：SharedWorker 内部 LRU 缓存 + 批量去重；后端：聚合器对热点组做二级缓存（增量 + 最近快照）。

## 7. UI/UX Architecture

### 7.1 Component Structure

容器/组件分层：
- containers/: 页面级容器（订阅/筛选/指标浮层）
- components/: DataGrid/Chart/AlgoForm/MetricsOverlay 等可复用组件
- workers/: shared‑worker、decoders、coalescer

### 7.2 Styling Approach

Tailwind 原子化 + 少量 CSS 变量；黑暗主题与高对比度主题并存。

### 7.3 Responsive Design

断点：≥1920｜1440｜1280｜1024｜768；低宽度下折叠次要面板并降级图表细节。

### 7.4 Accessibility

符合 WCAG 2.1 AA：键盘可达、焦点可见、表格可读摘要、色彩对比达标。

## 8. Performance Optimization

### 8.1 SSR Caching

实时页面不使用 SSR；仅对静态/营销页开启边缘缓存（HTML 30–60 min；静态资源长期缓存 + 指纹）。实时数据全部经 WS/NATS，避免缓存污染。

### 8.2 Static Generation

对登录/说明/设置等低时效页面做预渲染（构建期 SSG）；实时仪表页不做 SSG，确保首屏与水合成本最小。

### 8.3 Image Optimization

统一采用 WebP/AVIF，CDN 自动转码；UI 中图标走 SVG；图表截屏导出使用 Canvas 转码（质量/尺寸可配置）。

### 8.4 Code Splitting

路由级与组件级动态 import；图表/表格等大组件按需加载；SharedWorker 与解码器独立 chunk；长期缓存 + chunk 指纹。

## 9. SEO and Meta Tags

### 9.1 Meta Tag Strategy

基础 OpenGraph + 应用名称/主题色；实时页不做 SEO 指标。

### 9.2 Sitemap

静态页导出；实时页排除。

### 9.3 Structured Data

必要的组织/应用结构化数据，仅用于营销页。

## 10. Deployment Architecture

### 10.1 Hosting Platform

Dev：Docker Compose；Prod：Kubernetes（Ingress + Cert‑Manager + Prometheus/Grafana + Loki/Tempo）。

### 10.2 CDN Strategy

静态资源经 CDN；WS 长连接直连网关域名（同域/子域）。

### 10.3 Edge Functions

可选：边缘鉴权与流量整形（Cloudflare Workers/Pages Functions）。

### 10.4 Environment Configuration

通过 env 文件与 Secret 管理：NATS URLs、JWT、公钥、数据库 DSN、特性开关；CI 注入仅必要变量。

## 11. Component and Integration Overview

### 11.1 Major Modules

apps/ui、services/ws‑gateway、services/aggregator‑go、services/algo‑exec‑py、packages/contracts、packages/shared、infra/*

### 11.2 Page Structure

登录、主看板（行情/账户/风险）、策略下单、算法监控、设置。

### 11.3 Shared Components

表格单元格渲染器、延迟/带宽指标组件、告警条、主题切换、空状态与加载骨架。

### 11.4 Third-Party Integrations

Prometheus/Grafana、Loki/Tempo、K8s Ingress/Cert‑Manager。

## 12. Architecture Decision Records

见 docs/architecture‑decisions.md（ADR 索引与摘要）。

**Key decisions:**

- Why this framework? React 19 + TS 生态成熟、增量渲染能力强，配合 SharedWorker 适合高频 UI。
- SSR vs SSG? 实时页走 CSR；仅静态/营销页 SSG 以缩短首屏。
- Database choice? PostgreSQL 16.6 统一持久化；审计/回放走 JetStream，分离冷热路径。
- Hosting platform? Dev=Compose 快速迭代；Prod=Kubernetes 以满足扩缩容与观测治理。

## 13. Implementation Guidance

### 13.1 Development Workflow

Git 主干开发 + PR 检查；契约变更先行（buf 兼容检查）→ 代码生成 → 服务适配；CI：lint/format/test/build；CD：K8s 部署。

### 13.2 File Organization

Monorepo：apps/*、services/*、packages/*、infra/*；严格依赖方向 contracts → domain → app/service → interface。

### 13.3 Naming Conventions

NATS 主题：`xy.<domain>.<action>[.<scope>]`；代码：kebab‑case 文件、PascalCase 组件、snake_case Python。

### 13.4 Best Practices

禁止跨上下文直接耦合；接口幂等与超时/重试；慢消费者保护；指标/日志/追踪全链路；无超过 10 行的长代码块在文档中。

## 14. Proposed Source Tree

```
repo/
├─ apps/
│  └─ ui/
├─ services/
│  ├─ ws-gateway/           # Node.js（ws + nats.js）
│  ├─ aggregator-go/        # Go（NATS 订阅 → 增量/快照）
│  ├─ src-adapter-vnpy/     # Python（vn.py gateway → xy.src.* 发布）
│  └─ algo-exec-py/         # Python（vn.py + nats-py + FastAPI）
├─ packages/
│  ├─ contracts/            # Protobuf + buf（TS/Go/Py 代码生成）
│  └─ shared/
├─ infra/
│  ├─ k8s/                  # k8s manifests（ingress/issuer/deploy/svc）
│  └─ docker/
└─ docs/
   └─ …
```

**Critical folders:**

- packages/contracts: 唯一契约源（Protobuf + buf + 代码生成）
- services/algo-exec-py: 交易执行（vn.py + nats‑py + FastAPI）
- services/aggregator-go: 行情聚合（33ms 增量/2–5s 快照）

## 15. Testing Strategy

### 15.1 Unit Tests

前端：Vitest 覆盖组件/hooks；Node：Jest/Vitest 单元；Go：testify；Python：pytest。

### 15.2 Integration Tests

合约一致性测试（buf + 代码生成对比）；NATS Subjects 的请求‑应答与流式集成测试；WS 端到端。

### 15.3 E2E Tests

Playwright：关键用户路径（登录→订阅→筛选→下单→回执）。

### 15.4 Coverage Goals

前端/后端单元覆盖 ≥ 75%；关键路径集成/E2E 场景全覆盖。

（如需更高等级合规/渗透测试，另行引入专门安全/测试工作流。）

## 16. DevOps and CI/CD

CI：lint/test/build；版本与镜像打标签；安全扫描（SCA/Trivy）。CD：分阶段发布；回滚与健康门。监控：Prometheus/Grafana；日志：Loki；追踪：Tempo。

（如需多区域/多集群或合规要求，触发 devops‑architecture 专家工作流。）

## 17. Security

NATS 账户隔离与主题 ACL；JWT 短期令牌；TLS 强制；Secrets 管理；依赖安全扫描；最小权限访问；审计与告警通道。

（如需密码学硬件密钥/合规审计，触发 security‑architecture 专家工作流。）

---

## Specialist Sections

- DevOps：生产集群与分阶段发布策略可扩展为多区域/多集群（另见 devops‑architecture）。
- Security：如需硬件密钥、专线或合规审计，触发 security‑architecture 工作流。
- Testing：强化混沌/压测与 UI 性能基准，必要时引入 test‑architect。

---

_Generated using BMad Method Solution Architecture workflow_


━━━━━━━━━━━━━━━━━━━━━━━
## 前置条件校验与规模评估（Checkpoint）

- 项目：xiaoy
- 日期：2025-10-20
- 项目类型：web
- 项目等级：3
- PRD 状态：Complete（/home/yuewei/Documents/github/xiaoy_p/docs/PRD.md）
- UX 规范：Complete（docs/ux-spec.md）
- UI 项目：true

结论：✅ 前置条件已满足（PRD 与 UX 规范就绪），可执行解决方案架构。

下一步：如需更新 UX 规范，请先编辑 docs/ux-spec.md 后再运行本工作流以自动复检。

━━━━━━━━━━━━━━━━━━━━━━━
## 前置条件复检（Checkpoint）

- PRD：Complete（docs/PRD.md）
- UX 规范：Complete（docs/ux-spec.md）
- 结论：✅ 已通过前置条件校验；将继续执行解决方案架构工作流。

提示：如需修改上述文档，请先编辑对应文件再继续。

━━━━━━━━━━━━━━━━━━━━━━━
## Requirements Analysis（Checkpoint）

概览
- 项目级别：3（UI 项目）
- FR 数量：22；NFR 数量：5；Epics：5；Stories：31
- 架构驱动：低延迟与稳定帧率（≥60 FPS）、单连接一致性、可观测/可降级/可恢复、契约与权限治理

关键约束与决策前提
- 单条 WebSocket 连接 + SharedWorker 扇出（跨标签共享订阅与缓存）
- 服务端 NATS/JetStream 中枢，33ms 增量 + 2–5s 快照；慢消费者保护
- UI 增量绘制（Worker 解码 + OffscreenCanvas）；验收阈值：rAF 帧 p95 ≤ 16.7ms / p99 ≤ 25ms（与 PRD 一致）；工程预算：渲染预算 ≤ 8ms。
- 契约与代码生成（TS/Python），仅追加兼容策略；Subject ACL 最小权限
- 观测与降级：FPS/端到端延迟/带宽/慢消费者指标；采样降频→字段裁剪→面板停更
- 会话恢复 ≤3s；版本单调性校验；异常进入只读并告警

主要风险与缓解
- UI 抖动与背压扩散 → SharedWorker 批处理与优先级丢帧；慢消费者阈值与切换建议
- 聚合/组订阅成为单点 → 水平分片与限流，快照/增量双通路与回放核对
- 权限错配 → 最小权限主题 ACL + 审计打点；密钥轮换与环境隔离

范围边界
- 核心面板：行情/账户/风险；策略下单与算法监控

━━━━━━━━━━━━━━━━━━━━━━━
## Event Delivery Semantics（Checkpoint）

- 语义：UI 通道 at‑most‑once（至多一次投递）。
- 幂等键：`corr_id`（请求‑应答）+ 主题序列/版本（流式），端到端去重以 `corr_id`/`seq` 为依据。
- 去重位置：
  - 网关：按连接/主题维度去重与限流；慢消费者保护。
  - SharedWorker：16–33ms 批处理合并，按 `seq` 跳过重复/乱序低序列。
- 丢帧与合并策略（FR008）：
  - 优先级：核心交易/风险面板保真优先；非核心面板允许合并/降频。
  - 阈值：队列高水位/背压触发合并；达到阈值时采样降频→字段裁剪→停更次要面板（见降级策略）。
- 幂等接口：
  - 指令请求‑应答主题：要求 `idempotency_key`；重试需保持幂等。
  - 回执包含 `corr_id` 与状态码；重复回执由前端去重。

- MVP：单活跃组下行 ≤2 Mbps；优先满足 Trader 主视角

结论
- 需求具备 Level 3 架构设计条件，可进入模式/边界划分与技术决策阶段。

━━━━━━━━━━━━━━━━━━━━━━━
## User Context（Checkpoint）

- 沟通语言：Chinese
- 文档语言：Chinese
- 用户技能水平：intermediate（本对话采用相应交流风格；文档保持技术化与简明）
- 既有偏好/约束：
  - 消息中枢：NATS/JetStream；单连接 + SharedWorker 扇出
  - 浏览器：Chrome 稳定版；需 COOP/COEP 以启用 SAB（如启用）与 OffscreenCanvas
  - 安全：TLS + JWT/NKey；Subject ACL 最小权限；主题级审计
  - 可观测：FPS、端到端延迟、带宽、慢消费者事件
- 集成/依赖：
  - Schema Registry + TS/Python 代码生成；仅追加兼容策略
  - 聚合通道：33ms 增量 + 2–5s 快照，断点重建 ≤1s
- 打开问题（由架构阶段收敛）：
  - 是否需要 SSR/边缘渲染？（SEO 需求较低，倾向 CSR + 预渲染）
  - 仓库策略：单仓（monorepo）或多仓（polyrepo）？
  - 聚合服务语言选型（Go/Node 等）与发布节奏

━━━━━━━━━━━━━━━━━━━━━━━
## Architecture Patterns（Checkpoint）

架构风格与仓库策略
- 架构风格：DDD（限界上下文）+ 事件驱动 + 模块化单体（按上下文分层）+ 聚合器专用服务
  - 限界上下文：MarketData、AccountsRisk、StrategySuggestion、AlgoExecution、Platform
  - 反腐层（ACL）：UI/外部系统与领域模型之间的转换与防腐
  - 聚合器（MarketData 上下文）：33ms 增量、2–5s 快照，慢消费者保护
- 仓库策略：Monorepo（pnpm workspaces）+ Shared Contracts（Schema Registry + 代码生成）
  - `packages/contracts` 作为唯一契约来源（IDL + TS/Python 代码生成，“仅追加”演进）
  - `packages/domain-*` 按上下文拆分，依赖方向：contracts → domain → app/service（禁止反向依赖）
  - `apps/ui`、`services/ws-gateway`、`services/aggregator-go`、`services/algo-exec-py`、`infra/*`
- 部署思路：Dev= Docker Compose；Prod= Kubernetes；按上下文与吞吐弹性伸缩

取舍说明
- DDD 的模块化单体优先（团队小、演进快）；后续可按上下文“绞杀者”式拆分为独立服务
- 聚合器独立为服务，隔离实时计算影响，便于独立扩缩容与性能调优
- Shared Contracts 确保跨语言一致性与演进安全（契约先行、实现跟随）

影响与前提
- 严格包边界与 lint 规则（禁止跨层耦合/跨上下文直连）；跨上下文仅通过契约/消息交互，禁止共享数据库
- CI 强制契约兼容检查；发布采用“契约先行→实现跟随”的流程；事件/主题命名遵循上下文前缀

━━━━━━━━━━━━━━━━━━━━━━━
## Component Structure（Checkpoint）

限界上下文与组件边界
- Platform（平台底座）：身份鉴权（JWT/NKey）、Subject ACL、可观测（metrics/tracing/logging）、配置与特性开关
- MarketData（行情聚合）：aggregator-go（增量/快照）、schema/compat、回放/基准、慢消费者保护
- AccountsRisk（账户与风险）：资金/持仓/风险指标计算、1–2s 节奏、阈值告警与联动
- StrategySuggestion（策略建议）：手选 T 型报价 UI 支撑、自动生成与自动解析、参数模板与灰度
- AlgoExecution（算法执行）：下单接口、幂等键、超时/重试、审计打点、回执与错误码
  - Python 3.13.9 + vn.py 4.1.0；FastAPI 管理面；nats-py 2.11.0 处理指令/回执主题
- UI（单连接前端）：SharedWorker（单 WS + 扇出 + 批处理）、Panels（DataGrid/Chart/AlgoForm/MetricsOverlay）

跨上下文通信
- 统一通过 `packages/contracts` 暴露的 IDL/Schema 与消息主题；严禁共享数据库或跨上下文内部类型耦合
- UI 与后端通过 WS/Gateway 以契约消息交互；Gateway 仅做协议与鉴权转换，不做业务拼装

Epic → 上下文 → 组件映射
| Epic | 上下文 | 主要组件 |
| ---- | ------ | -------- |
| 1. 基础设施与单连接骨架 | Platform / UI / MarketData | contracts、ws-gateway、shared-worker、aggregator-go (skeleton) |
| 2. 虚拟账户监控 | AccountsRisk / UI | risk-metrics、accounts-read-model、va-monitor panel |
| 3. 手选T型报价 | MarketData / UI | quotes-read-model、tshape panel、metrics overlay |
| 4. 自动生成与自动解析 | StrategySuggestion / UI | generator-core、parser、algo-params、auto-gen panel |
| 5. 策略下单与执行 | AlgoExecution / UI | order-api、idempotency、algo-manager、execution monitor |

边界规则（不变式）
- 依赖方向：contracts → domain（上下文内部）→ app/service → interface（gateway/ui）
- 领域内部允许聚合/仓储/服务模式；跨上下文通过事件/请求-应答（经过契约）
- 任何跨边界数据都必须序列化为契约类型；不暴露内部实体

结论
- DDD 上下文划分稳定，满足 FR/NFR 的实现与扩展；后续可在 Step 5 补充技术决策与版本。

━━━━━━━━━━━━━━━━━━━━━━━
## Technical Decisions（Checkpoint）

技术栈与版本（重构基线：UI 与通信重构为 Web + NATS；不复用桌面 UI 与 ZMQ RPC 源码，交易 API 继续使用 Python/vn.py。所有版本均固定并通过 lockfile 保障可复现）

| 类别 | 技术 | 版本 | 说明与理由 |
| --- | --- | --- | --- |
| Runtime（UI/Gateway） | Node.js | 22.11.0 LTS | 与前端工具链和 ws 网关兼容。
| Backend Lang | Go | 1.25.3 | 聚合器高吞吐、低 GC 暂停；与 NATS 生态契合。
| Backend Lang | Python | 3.13.9 | 交易/执行域主语言；与 vn.py 生态兼容。
| 包管理（Py） | uv | 0.5.10 | 统一 Python 依赖与虚拟环境，`uv.lock` 固化构建。
| UI 框架 | React | 19.2.0 | 实时 UI 生态成熟，支持并发特性。
| 构建/Dev | Vite | 7.1.4 | 快速开发与构建。
| 语言 | TypeScript | 5.9.2 | 与 React 19 生态兼容。
| 样式 | Tailwind CSS | 4.1.13 | 原子化样式，降低样式复杂度。
| 状态管理 | Zustand | 5.0.8 | 细粒度订阅，适合高频更新。
| 表格 | TanStack Table | 8.21.3 | Headless 表格/Datagrid。
| WebSocket 服务 | ws | 8.18.3 | 轻量高性能 WS 实现。
| 消息总线（服务端） | NATS Server | 2.12.1 | JetStream、原子批量发布等增强。
| 消息客户端（Go） | nats.go | 1.46.0 | Go 端 NATS 客户端。
| 消息客户端（JS/TS） | nats.js | 2.28.2 | 浏览器/Node 通用 NATS 客户端。
| 消息客户端（Python） | nats-py | 2.11.0 | Python 端 NATS 客户端，用于 AlgoExecution 与策略侧集成。
| 包管理（JS） | pnpm | 9.12.2 | Monorepo 包管理与工作区隔离。
| 合同与序列化 | protoc | 28.2 | Protocol Buffers 代码生成。
| 契约治理 | buf | 1.35.0 | 契约仓库管理与兼容检查（append‑only）。
| 观测（Go） | client_golang | 1.23.2 | Prometheus Go 客户端。
| 观测（Node） | prom-client | 15.1.3 | Prometheus Node 客户端。
| 观测（Py） | prometheus-client | 0.20.0 | Prometheus Python 客户端。
| 日志（Node） | pino | 9.9.4 | 低开销 JSON 日志。
| 日志（Py） | loguru | 0.7.2 | 结构化日志（交易侧）。
| 数据处理（Python） | pandas | 2.3.3 | 交易/回测常用表格计算。
| 数据处理（Python） | polars | 1.34.0 | 高性能批量与流式计算（可选）。
| 数据/ORM | PostgreSQL | 16.6 | 统一数据存储；流式与审计分离。
| ORM | SQLAlchemy | 2.0.36 | Python 持久化；配合 Alembic 1.13.2。
| 统计/科学计算 | scipy | 1.13.3 | 与既有策略/指标兼容。
| 技术指标 | TA-Lib | 0.4.28 | Linux 走源码编译；Windows 用预编译轮子；仅算法侧需要。
| 调度 | APScheduler | 3.10.4 | 任务/节奏调度（1–2s 指标节拍）。
| DB 驱动 | psycopg[binary] | 3.2.1 | 统一首选 PostgreSQL；保留 Peewee 逐步迁移。
| Web API（Python） | FastAPI | 0.119.0 | AlgoExecution 控制/状态接口。
| ASGI（Python） | uvicorn | 0.38.0 | 生产可用 ASGI 服务器。
| 交易框架 | vn.py | 4.1.0 | 与实盘/仿真网关集成（CTP/券商/风控等）。

补充决策（简要）
- UI 渲染：CSR 为主；首屏/营销页可预渲染；图表/表格使用 OffscreenCanvas + 批量绘制。
- 通信与契约：统一 NATS；请求‑应答走 NATS RPC；流式走 JetStream；契约以 Protobuf + buf 治理，append‑only。
- AlgoExecution（Python/vn.py）：通过 nats‑py 订阅指令主题、发布回执；FastAPI 暴露管理与健康检查。
- 数据与迁移：PostgreSQL + SQLAlchemy + Alembic；审计/回放使用 JetStream（不落 DB）。
- 安全：NATS Accounts + NKey/JWT；TLS；WS 网关与前端走会话 JWT。
- 测试：前端 Vitest/Playwright；Go 端 testify；Python 端 pytest。

与 PRD/NFR 的一致性
- 单连接 + SharedWorker：与 ws + nats.js 组合配合，Worker 内批处理/去重。
- 33ms 增量 / 2–5s 快照：由 aggregator‑go 实现；JetStream 审计/回放。
- 可观测：client_golang / prom‑client / prometheus‑client 输出 UI/端到端延迟、带宽、慢消费者等指标。

━━━━━━━━━━━━━━━━━━━━━━━
## Solution Architecture（Checkpoint）

已按模板生成完整主体（技术决策表/组件/数据/接口/源代码树/测试/DevOps/安全/ADRs）。

━━━━━━━━━━━━━━━━━━━━━━━
## Cohesion Validation（Checkpoint）

- FR 覆盖：22/22
- NFR 覆盖：5/5（详见 docs/cohesion-check-report.md）
- Epics 映射：5/5（详见 docs/epic-alignment-matrix.md）
- Readiness：95%（剩余：细化运维手册）

━━━━━━━━━━━━━━━━━━━━━━━
## Epic Tech Specs（Checkpoint）

- 已生成 5 份技术规格：
- docs/tech-spec-epic-1.md
- docs/tech-spec-epic-2.md
- docs/tech-spec-epic-3.md
- docs/tech-spec-epic-4.md
- docs/tech-spec-epic-5.md

用途：每份仅包含与该史诗相关的技术细节，供 Phase 4 实施使用。

━━━━━━━━━━━━━━━━━━━━━━━
## Completion Summary（Checkpoint）

Artifacts
- Architecture: docs/solution-architecture.md（本文件）
- Cohesion Report: docs/cohesion-check-report.md
- Epic Alignment Matrix: docs/epic-alignment-matrix.md
- Tech Specs: docs/tech-spec-epic-1..5.md
- ADRs: docs/architecture-decisions.md

Quality Gates
- 技术决策表 = 具体版本、无多选项 ✓
- 源代码树 = 完整、与栈一致 ✓
- FR/NFR 覆盖 = 见 Cohesion Report ✓

Next
- 更新工作流状态（Step 12）：标记 solution-architecture 完成，并从 epics.md 填充 story 队列
- 进入 Phase 4：create-story → story-ready → story-context → dev-story → story-approved

━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━
## Reliability & Compliance Targets（Checkpoint）

- 可用性与恢复
  - RTO ≤ 10 分钟；RPO ≤ 5 分钟。
  - 服务健康：WS 网关与聚合器提供 liveness/readiness 探针，滚动升级与灰度回滚策略明确。
  - 慢消费者保护：阈值触发限流与优先级丢帧，自动恢复策略与告警通道就绪。
- 留存与审计（JetStream）
  - 流 `XY_MD_TICK`：保留 3 天或 200 GiB（先到为准）；`XY_REF_CONTRACT`：保留 30 天或 20 GiB。
  - 审计导出：仅审计角色可访问；导出需变更工单与双人审批；导出日志留痕 180 天。
- 备份与校验
  - PostgreSQL 每日全量 + 每 15 分钟增量；周度恢复演练与校验报告。
- 合规
  - 主题级 ACL 最小权限；密钥轮换与访问审计；数据删除与导出流程规范化。

> 注：以上目标用于补齐 NFR（合规/留存）量化指标，与 PRD 口径保持一致；实现细节在 DevOps 手册中细化。
## Market Data Sources（Checkpoint）

- 已补充行情源与适配层设计：见 docs/market-data-sources.md
- 新增服务：services/src-adapter-vnpy（vn.py → xy.src.* 发布）
- 新增主题：xy.src.tick.{venue}.{symbol}、xy.ref.contract.{venue}.{symbol}、xy.src.heartbeat.{venue}
- 聚合器输入/质量/回放/权限均已定义（详见“2.5 Market Data Ingestion”章节）

━━━━━━━━━━━━━━━━━━━━━━━
## Access Control (ACL) — Sample Table（Checkpoint）

原则
- 最小权限、默认拒绝；仅授予明确前缀。
- 短期会话 JWT（15 分钟）+ 刷新令牌（≤ 12 小时）；NKey 月度轮换。
- 禁止跨上下文的“写入”权限；数据面与控制面分离。

| 角色（NATS Account） | Publish | Subscribe | 备注 |
| --- | --- | --- | --- |
| trader-ui | `xy.exec.order.place.>` | `xy.md.>`, `xy.ref.contract.>`, `xy.exec.order.result.>`, `xy.risk.metrics.>` | 只读市场/账户/风险；不可访问 `xy.src.*` |
| ws-gateway | `xy.exec.order.place.>` | `xy.md.>`, `xy.ref.contract.>`, `xy.exec.order.result.>`, `xy.ctrl.user.>` | 代表 UI 转发；不得写入 `xy.md.*` |
| aggregator-go | `xy.md.tick.>`, `xy.md.snapshot.>` | `xy.src.tick.>`, `xy.src.replay.>`, `xy.ref.contract.>` | 只产出增量/快照；不触达执行主题 |
| algo-exec | `xy.exec.order.result.>`, `xy.risk.events.>` | `xy.exec.order.place.>` | 以 `corr_id` 幂等处理；只读市场数据由网关转发 |
| admin-audit | （无） | `xy.md.>`, `xy.exec.order.>`, `xy.risk.>` | JetStream 消费者创建/读取权限；JIT 令牌，强审计 |

命名与语义
- 事件命名：`xy.<context>.<entity>.<action>[.<scope>]`；读流以 `xy.md.*`、写指令以 `xy.exec.*`。
- 交付语义：UI 通道 at‑most‑once；请求‑应答使用 `corr_id` 与 `idempotency_key`。

最小示例（nats-server 账户片段）
```yaml
accounts:
  trader:
    permissions:
      publish:   ["xy.exec.order.place.>"]
      subscribe: ["xy.md.>", "xy.ref.contract.>", "xy.exec.order.result.>"]
```

> 完整权限清单与密钥轮换流程见运维手册；生产环境请按租户/环境进一步分区（如 `xy.dev.*` / `xy.prod.*`）。
