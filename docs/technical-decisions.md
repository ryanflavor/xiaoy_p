# Technical Decisions Log — xiaoy

Author: ryan
Date: 2025-10-20

This file records key technical decisions referenced by PRD/epics. Each entry includes rationale and implications. Status defaults to "Proposed" unless otherwise noted.

---

Decision Index (quick view)

| ID | Title | Status |
| -- | ----- | ------ |
| TD‑001 | 单连接 + SharedWorker 扇出 | Accepted (MVP) |
| TD‑002 | Worker 解码 + OffscreenCanvas | Accepted (MVP) |
| TD‑003 | 数据契约与兼容（FBS/Proto + Registry） | Accepted (MVP) |
| TD‑004 | 安全与权限（TLS + JWT/NKey + ACL） | Accepted (MVP) |
| TD‑005 | 可观测与降级（采样/裁剪/停更） | Accepted (MVP) |
| TD‑006 | 一致性与会话恢复 | Accepted (MVP) |
| TD‑007 | GPU/渲染路径 | Accepted (MVP) |
| TD‑008 | ZMQ 过渡策略 | Superseded by TD‑009 |
| TD‑009 | 单一角色 + 直达 NATS/JetStream | Accepted (MVP) |
| TD‑010 | NATS Subject & ACL 规范 | Accepted (Baseline) |
| TD‑011 | 错误码与回执语义 | Accepted (Baseline) |
| TD‑012 | 幂等与去重窗口 | Accepted (Baseline) |
| TD‑013 | 降级阈值与恢复条件 | Accepted (Baseline) |
| TD‑014 | 指标与命名规范（OTel/Prom） | Accepted (Baseline) |
| TD‑015 | 跨源隔离与 SAB 启用策略 | Accepted (Baseline) |
| TD‑016 | 快照/增量契约（序列/版本/重建） | Accepted (Baseline) |

## TD-001 — 单连接 + SharedWorker 扇出
- Decision: 浏览器仅保持 1 条 WebSocket 连接；通过 SharedWorker 扇出到多标签页。
- Rationale: 降低带宽与解码重复，避免“连接风暴”。
- Implications: 需要 BroadcastChannel/MessagePort 通讯；订阅在 SharedWorker 统一整形与去重。
- Status: Accepted (MVP)

## TD-002 — 渲染管线：Worker 解码 + OffscreenCanvas 批量绘制
- Decision: Worker 解码二进制（FBS/Proto）→ SoA TypedArray 环形缓冲 → OffscreenCanvas 增量绘制。
- Rationale: 保证 60 FPS 与低抖动，隔离主线程长任务。
- Implications: 需要 rAF 对齐批处理与“时间预算”切片；GPU/Canvas 兼容性评估。
- Status: Accepted (MVP)

## TD-003 — 数据契约与兼容
- Decision: 增量用 FlatBuffers，快照用 Protobuf；引入 Schema Registry + TS/Python 代码生成；“仅追加”兼容策略。
- Rationale: 提升演进速度与跨端一致性，降低破坏性变更风险。
- Implications: CI 必须引入兼容性检查；运行时未知字段需容忍并打点。
- Status: Accepted (MVP)

## TD-004 — 安全与权限
- Decision: TLS + JWT/NKey 鉴权，Subject ACL 最小权限；主题级审计日志。
- Rationale: 内网但需最小权限与可追溯。
- Implications: 秘钥轮换 ≤ 90 天；拒绝日志纳入告警面板。
- Status: Accepted (MVP)

## TD-005 — 可观测与降级
- Decision: 全链路埋点（adapter→aggregator→WS→UI），慢消费者检测；三段式降级（采样→裁剪→停更）。
- Rationale: 在峰值与异常情况下保持可用并可诊断。
- Implications: 定义统一指标命名与错误预算阈值；UI 明示降级与恢复。
- Status: Accepted (MVP)

## TD-006 — 一致性与会话恢复
- Decision: 版本单调性校验；不一致时自动请求全量快照；断线恢复 ≤ 3s。
- Rationale: 降低重连/版本错位带来的用户中断。
- Implications: Aggregator/WS 网关需提供序列/版本一致性元数据。
- Status: Accepted (MVP)

## TD-007 — 前端 GPU 要求与渲染路径
- Decision: 当前不依赖 WebGPU/三维渲染；采用 Canvas/OffscreenCanvas 增量绘制，优先走浏览器硬件加速（GPU 进程）。
- Rationale: 满足 ≥60 FPS 与端到端时延目标的同时，兼容更广的办公环境；避免对专用显卡的强依赖。
- Implications:
  - 必须启用 Chrome 硬件加速；在多显示器或 4K 环境下，建议使用较新的 iGPU（如 Intel Iris Xe）或入门 dGPU 以保证余量。
  - 若在虚拟桌面/远程环境禁用了硬件加速，可通过降级策略（采样/裁剪/停更）与降低 Top‑K 维持可用性。
- Status: Accepted (MVP)

## TD-008 — 现状澄清与 MVP 迁移策略（ZMQ → WS/NATS）
- Context (from discussion):
  - 交易员通过 `client.py` 登录并使用 ZMQ 与后台 `app.py / algo.py / strategy.py` 通信。
  - 每个交易员在 DB 中绑定 IP；后台进程通过 `deploy.py` 部署与管理生命周期。
  - `client.py` 下达指令给 `algo.py`；`algo.py` 根据参数驱动 `trader.py` 执行账户层面的下单/操作。
  - `trader.py` 的「参数化实例」即具体实盘账户；实盘账户通过 `account_manager` 关联到虚拟账户。
- Decision:
  - Phase 0（MVP）：保留后端 ZMQ 形态不改动业务内核；新增轻量网关（`WS ⇄ ZMQ`）供 Web 前端使用。网关提供统一鉴权、幂等请求‑应答、错误码映射与观测指标。
  - Phase 1（可选）：引入 NATS/JetStream 聚合与主题治理（与 PRD 中的长期目标对齐），逐步将 ZMQ 终端迁移到 NATS 适配层，避免一次性重写。
- Rationale: 最小化迁移风险与范围，尽快交付可用的 Web UI 和下单闭环；同时为后续契约治理与可观测性留接口。
- Implications:
  - 需要定义 `WS ⇄ ZMQ` 请求/回执协议（包含 `request_id`、超时/重试、错误码、审计字段）。
  - 网关负责身份态（IP 绑定/Token）与权限最小化（仅允许所需指令与账户域）。
  - 观测：暴露连接数、消息速率、慢消费者、端到端延迟等指标；与 UI 指标浮层对齐。
  - 与 TD‑001/002/003 保持兼容：前端单连接与契约治理按“仅追加”策略演进。
- Open Questions:
  - ZMQ 具体通信范式：`REQ/REP`、`PUB/SUB`、`DEALER/ROUTER` 的组合？是否存在独立行情与交易通道？
  - 身份与授权：仅 IP 绑定，还是需要附加 Token / JWT？撤单等敏感操作是否二次确认？
  - 订单回执语义：是否存在“已受理/已成交/失败”多阶段回执？超时阈值与重试策略？
- Status: Superseded by TD-009

## TD-009 — 单一角色策略（Trader）与“直达 NATS/JetStream”的迁移路线（取代 ZMQ 网关）
- Decision:
  - Persona 策略：采用单一主角 Trader；其余职责作为系统使能（Enabler）承载在 NFR/Enabler 故事中。
  - 架构策略：放弃中间层 ZMQ 网关与过渡方案，在 MVP 即以 NATS/JetStream 为消息中枢；前端通过 WS 网关直连聚合服务。
- Rationale:
  - 降低角色复杂度与沟通成本，把“价值与验收”全部绑到 Trader 的效率与稳定。
  - 避免多链路/双栈运维成本与一致性问题，减少迁移阶段的状态分裂。
- Implications:
  - 立即交付：NATS 主题/ACL、Schema Registry 与仅追加策略、端到端观测与降级、单连接 WS 网关、最小下单闭环。
  - ZMQ 相关资产若需保留，仅作为回放/对照或工具链使用，不进入主链路；未来如需接入，走独立适配层并与契约治理一致。
  - 文档与故事均以单 persona 叙述；出现“平台/运维/风控/策略工程师”时，按 Enabler 标注并说明其服务的 Trader 价值。
- Status: Accepted (MVP)

## TD-010 — NATS Subject 命名与 ACL 规范
- Decision:
  - 主题命名（例）：
    - 行情增量：`agg.delta.{group}`（FBS，33ms）
    - 行情快照：`agg.snapshot.{group}`（Proto，2–5s）
    - 下单请求：`orders.req.{account}`（Req/Rep）
    - 下单回执：`orders.ack.{account}.{request_id}`（单播）
    - 算法事件：`algo.events.{account}.{algo_id}`（广播）
  - ACL：按最小权限授予 group/account 级别读写；运营/监控主题独立并只读。
- Rationale: 标准化主题结构，最小化权限域，方便审计与路由。
- Implications: Subject 与账户/组映射表需集中治理；CI 校验主题清单与 ACL 变更。
- Status: Accepted (Baseline)

## TD-011 — 错误码映射与回执语义
- Decision:
  - 错误码区段：
    - 1xxx 客户端校验（表单/权限/参数）
    - 2xxx 网络/超时/幂等冲突
    - 3xxx 服务端/算法执行失败
  - 回执阶段：`ACCEPTED`（受理）→ `PARTIAL`（部分成交，可选）→ `FILLED`/`FAILED`；每阶段均含 `request_id`、时间戳与可诊断字段。
- Rationale: 统一前后端错误与回执体验，便于告警与审计。
- Implications: 网关/算法需实现统一异常到错误码的映射；前端 ErrorSheet 统一呈现。
- Status: Accepted (Baseline)

## TD-012 — 幂等与去重窗口
- Decision:
  - 前端幂等键：`ulid()`（时间有序）+ 用户/账户/模板摘要；
  - 去重窗口：服务端维持最近 2 分钟或 5k 条请求的幂等记录，命中则返回首次回执；
  - 重试：指数退避 ≤ 3 次；超时与重复提交均打审计。
- Rationale: 防止重复下单与“假成功”；在网络抖动下保持幂等与可追溯。
- Implications: 需要幂等存储（内存 + 短期持久化），并暴露命中率指标。
- Status: Accepted (Baseline)

## TD-013 — 降级阈值与恢复条件
- Decision:
  - 触发条件（任一满足）：UI FPS < 55 持续 2s；端到端 P95 > 120ms 持续 10s；慢消费者累计 > N 次/分钟；主线程长任务 > 50ms 占比 > 5%。
  - 顺序：采样（减半）→ 字段裁剪（去次要列/低优先级面板）→ 暂停次要面板刷新。
  - 恢复：指标回到阈值 80% 以下并稳定 30s，逐级恢复。
- Rationale: 明确触发/恢复，减少人工判断成本。
- Implications: 需在前后端统一指标与优先级表；UI 明示当前降级状态。
- Status: Accepted (Baseline)

## TD-014 — 指标与命名规范（OpenTelemetry/Prometheus）
- Decision:
  - 命名：`app.subsystem.metric`，单位后缀（`_ms/_bytes/_count`）统一；
  - 核心 SLI：`ui_fps`, `e2e_latency_ms_p50/p95/p99`, `ws_backlog_bytes`, `slow_consumer_count`, `retry_count`；
  - Tracing：对下单路径与订阅变更链路采样 1–5%。
- Rationale: 统一指标口径与面板构建，支持快诊断。
- Implications: 定义标签集合（account/group/panel/env）；Prom/OTel 导出与告警模板内置。
- Status: Accepted (Baseline)

## TD-015 — 跨源隔离与 SharedArrayBuffer 启用策略
- Decision:
  - 强制 COOP/COEP + HTTPS；跨源隔离自检不通过则禁用 SAB 路径，退化为结构化克隆；
  - 记录自检结果与降级原因，提示用户开启硬件加速/企业策略白名单。
- Rationale: SAB 受浏览器安全策略约束，需有可靠退路。
- Implications: 影响性能路径与内存拷贝次数；需在 UX 中明示兼容与退路。
- Status: Accepted (Baseline)

## TD-016 — 快照/增量契约（序列/版本/重建）
- Decision:
  - 增量（FBS）携带 `seq` 与 `ver`；快照（Proto）携带 `base_seq` 与 `ver`；
  - 客户端检测到 `seq` 跳变或 `ver` 不一致时，自动请求快照重建；
  - 重建目标 ≤ 1s；重建期间面板进入只读提示。
- Rationale: 降低错位/丢包带来的 UI 乱序与不可读风险。
- Implications: 网关/聚合需暴露重建接口与速率限制；UI 需有进度与结果提示。
- Status: Accepted (Baseline)

---

Traceability（PRD/NFR ↔ TD）

- FR003/FR004 ↔ TD‑001（单连接/SharedWorker）
- FR007/FR008 ↔ TD‑002（渲染管线）
- FR011/FR022 ↔ TD‑003（契约与兼容）
- FR012 ↔ TD‑004（ACL/审计）
- FR013/FR014 ↔ TD‑005（观测/降级）+ TD‑014（指标）+ TD‑013（阈值）
- FR015 ↔ TD‑006（一致性/恢复）+ TD‑016（快照/增量）
- FR010 ↔ TD‑011/TD‑012（错误与幂等）
- NFR001 ↔ TD‑002/TD‑013/TD‑014（性能与阈值）
- NFR003 ↔ TD‑004/TD‑011（安全/审计/错误）

Review Cadence
- 每周更新：新增/变更 TD，标注状态流转（Proposed → Accepted/Deprecated → Superseded）。
- 重大变更需补充 ADR（见 `bmad/bmm/workflows/3-solutioning/ADR-template.md`）。

---

Appendix — Dropped Alternatives

- TD‑008（ZMQ 过渡方案）
  - 状态：Superseded by TD‑009（2025‑10‑20）
  - 原因：为降低双栈复杂度与一致性风险，按 PRD/UX 与 MVP 目标，直接采用 NATS/JetStream；ZMQ 资产仅作为回放/工具链保留。
