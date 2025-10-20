# 产品简报：xiaoy

**日期：** 2025-10-20
**作者：** ryan
**Status:** Draft for PM Review

---

## 项目初始背景（initial_context）

来源文档：
- docs/bmm-workflow-status.md（项目状态与路径）
- docs/brainstorming-arch-2025-10-17.md（系统/交互时序草图）
- docs/brainstorming-execution-checklist-2025-10-17.md（两周 PoC 检查清单）
- docs/brainstorming-session-results-2025-10-17.md（头脑风暴结论）

关键信息提炼：
- 场景与目标：Web 前端实时展示高频行情与账户/风控信息，替代现有 PyQt5 + ZMQ；后端标准化为 NATS/JetStream 与 vn.py 适配层。
- 实时链路：33ms 微批增量（FlatBuffers）+ 2–5s 周期快照（Protobuf）；按组（group）输出，聚焦 ROI 字段与 Top‑K；单用户 1 条 WS 连接，由 SharedWorker 扇出到多标签页。
- 交互与命令：交易指令走 NATS 请求‑应答通道（幂等/重试/超时）；账户/风险 1–2s 节奏更新；实时行情采用 at‑most‑once，审计/补偿走 JetStream。
- 客户端渲染：Worker 解码 → SoA TypedArray 环形缓冲 → OffscreenCanvas/Canvas 批量绘制，rAF 帧对齐增量更新。
- 性能与 SLO（PoC）：
  - 吞吐：平均 ~2,000 tick/s；峰值 ~4,000 tick/s；单屏 ~100 可见行；常见 4–5 个窗口并开。
  - 帧率/延迟：UI ≥ 60 FPS；端到端 P95 < 120ms、P99 < 180ms；主线程 CPU < 30%、总 CPU < 50%；GC Major < 1 次/分钟。
  - 网络：每活跃组下行 ≤ 2 Mbps；每用户 1 WS 连接，显式慢消费者保护。
- 运行环境与规模：内网、Win10 + Chrome、多屏交易席位；8–10 名交易员、≈50 个策略账户、标的规模 ≈ 2 万合约。
- 安全与治理：JWT/NKey 与 Subject ACL 最小权限；Schema Registry + 代码生成（TS/Python）；仅追加兼容策略。
- 风险提示：UI 抖动与长任务、背压扩散、聚合服务/组订阅成为单点、权限错配等。

初步问题陈述（草案）：
- 现有桌面端方案在多账户、多窗口与高吞吐下难以稳定达成“低延迟、低抖动、可观测”的交互体验与统一消息治理，需迁移到基于 NATS 的 Web 架构，在保持业务可用性的同时达成 60FPS 与 P95 < 120ms 的端到端时延目标。

初步目标用户（草案）：
- 盘中交易员与风控人员（内网、多屏、需并发查看多组合约与账户状态）。

待你确认的开放决策（精选）：
- 端到端延迟目标阈值（P50/P95/P99）。
- 传递语义（at‑most‑once vs at‑least‑once）与允许的丢帧/合并帧策略。
- 屏内规模与并发窗口：最大可见行/面板数的设计基线。
- SharedWorker/SharedArrayBuffer 是否启用；合并窗口偏好（16/33/50/100ms 等）。

---

## 协作模式（collaboration_mode）

选择：交互式（逐节共创）

---

## Executive Summary

产品概念（1–2句）
- 基于 NATS 的下一代 Web 交易席位，服务端以“33ms 增量 + 2–5s 快照”的聚合通道输出，前端采用单连接 SharedWorker 扇出、Worker 解码与 OffscreenCanvas 批量绘制，面向高吞吐行情与账户/风控的低延迟交互。

主要问题
- 现有 PyQt/ZMQ 形态在 4k tick/s 峰值与多窗口并发下难以稳定达到低延迟、低抖动与可观测目标，影响盘中操作与风控效率。

目标用户
- 自营/量化交易员与风控人员（内网多屏席位，需并发监控多组合约与账户状态）。

关键价值
- 稳定 ≥60 FPS、端到端 P95 < 120ms；单用户一条连接降低带宽与解码开销；以 Schema Registry 治理消息与版本；内建慢消费者与延迟指标，支持 JetStream 审计/回放与后续智能降级。

---

## Problem Statement

业务背景
- 盘中交易员与风控需要在多屏环境中并发查看与操作多组实时行情、账户与风险信息；现有桌面端（PyQt5 + ZMQ）方案在高吞吐、多窗口场景下难以稳定满足“低延迟、低抖动、可观测”的交互与治理要求。

现状与负载特征
- 数据规模与节奏：平均 ~2,000 tick/s，峰值 ~4,000 tick/s；单屏约 100 行可见，常见同时打开 4–5 个窗口；内部局域网、Win10 + Chrome 环境。

主要痛点（可度量）
- 延迟与抖动：逐 tick 渲染与多窗口导致主线程阻塞与掉帧风险，高峰下难以稳定达到 ≥60 FPS 与端到端低延迟目标。
- 扩展性与多标签页：每标签页独立连接与解码造成带宽与解码重复，容易形成“连接风暴”和前端资源竞争。
- 消息治理：缺乏统一 schema/版本与最小权限 ACL；行情与交易命令耦合，背压易在链路间扩散。
- 可观测性：端到端指标与慢消费者可见性不足，难以及时定位瓶颈并采取降级策略。

为何现在
- 正在推进 PyQt/ZMQ → Web/NATS 的体系化迁移；两周 PoC 目标已明确，需要以统一架构和指标门槛支撑产品化路线与后续 PRD/技术方案。

目标与判据（用于验证问题是否被解决）
- 稳定 ≥60 FPS；端到端延迟 P95 < 120ms、P99 < 180ms；单用户 1 条 WS 连接扇出；每活跃组下行 ≤ 2 Mbps；在 4–5 窗口并开与峰值 4k tick/s 时仍保持可用与可观测。

---

## Proposed Solution

总体策略（What & Why）
- 以 NATS 为消息中枢，构建“快路径实时、慢路径审计”的双通道方案：UI 走 at‑most‑once 低时延快路径；JetStream 负责审计/回放/追溯，避免重放拖慢前端。
- 服务端引入聚合器（Aggregator）输出“33ms 增量 + 2–5s 周期快照”，并按“组（group）+ ROI 字段 + Top‑K”裁剪，显著降低带宽与解码压力。
- 浏览器侧坚持“单连接、并行解码、批量绘制”：单用户 1 条 NATS‑WS 连接 → SharedWorker 扇出到多标签页；Worker 解码二进制 → SoA 环形缓冲；OffscreenCanvas/Canvas rAF 对齐批绘。

关键能力与差异化
- 单连接扇出：杜绝多标签/多窗口各自建连导致的“连接风暴”和重复解码，配合慢消费者检测与显式背压信号。
- 自适应产流：聚合器基于行/字节/毫秒预算自调频率与批大小；超限时触发降采样/合并帧；可按组实时变更订阅成员（250–500ms 去抖）。
- 统一 Schema 治理：快照用 Protobuf、增量用 FlatBuffers；配套 Schema Registry 与 TS/Python 代码生成，采用“仅追加”兼容策略。
- 命令与行情解耦：交易指令使用 NATS 请求‑应答（幂等 id、超时/重试），与行情广播主题解耦，避免背压互相污染。
- 可观测性内建：端到端指标（FPS、rAF 帧时分位、CPU、网络吞吐、丢帧/合并帧、慢消费者告警）可视化；支持降级切换策略。

理想用户体验（以交易席位为中心）
- 多窗口（4–5）并开仍保持 ≥60 FPS；列表与图表增量平滑，无“鼠标点不动”。
- 组订阅即时生效：勾选/搜索加入分组，250–500ms 内聚合器更新，下一批次即可见。
- 账户/风险面板 1–2s 节奏刷新；订单下达即时获得 ack/rep，失败有明确重试/告警路径。
- 会话恢复与断线重连：自动重连并恢复订阅，避免人工干预。

成功条件（与 SLO 对齐）
- UI 帧率 ≥60 FPS；端到端 P95 < 120ms、P99 < 180ms；单用户 1 条 WS 连接；每活跃组下行 ≤ 2 Mbps；峰值 4k tick/s 与 4–5 窗口并开时仍满足。

里程碑（PoC → 产品化）
- PoC（2 周）：聚合器/WS 网关/Schema+代码生成/数据模拟器 + 前端 Demo（列表 + 账户/风险 + 简单参数）+ 指标仪表。
- 产品化（后续）：完善权限与审计流水、观测与告警、回放工具、降级策略库与压测基线脚本。

---

## Target Users

### Primary User Segment

角色与画像
- 盘中交易员（自营/量化/做市/套利等），内网交易席位，Win10 + Chrome，多屏（常见 6 屏），单席位常开 4–5 个窗口。
- 账户结构：≈50 个策略账户，单策略连接 1–2 个实账户；并发用户规模：8–10 名交易员。

当前工作流（简化）
- 订阅/查看“组级”行情面板（~100 可见行），在多窗口间切换关注组。
- 调参与下单（参数面板），同时关注账户状态与风险阈值。
- 盘中快速定位热点标的与异常（跌宕、滑点、风控触发）。

痛点与约束
- 高频数据导致 UI 抖动、长任务与掉帧；多窗口/多标签易形成“连接风暴”。
- 行情与交易命令耦合，背压扩散；缺少统一 schema/ACL 与可观测指标。
- 需要在不中断交易的前提下完成席位迁移与会话恢复。

成功标准（与 SLO 对齐）
- ≥60 FPS；端到端 P95 < 120ms / P99 < 180ms；单用户 1 条 WS 连接扇出；每活跃组 ≤ 2 Mbps；峰值 4k tick/s、4–5 窗口并开仍可用。

### Secondary User Segment

风控与运营
- 风控员/风控服务：1–2s 节奏获取账户与风险指标，关注阈值/熔断/滑点异常与告警路由；要求稳态与可追溯。

审计与回放
- 运营/合规/回测人员：依赖 JetStream 审计流水与回放；对实时延迟不敏感，但要求事件完整性与版本兼容。

运维与平台
- 平台/运维工程师：需慢消费者可见性、链路指标与降级策略；要求统一 schema/代码生成与权限最小化。

---

## Goals and Success Metrics

### Business Objectives

- 完成基于 NATS 的全新前后端席位系统 PoC（从零重写），并形成产品化路线与压测基线。
- 建立统一消息与权限治理：Schema Registry + TS/Python 代码生成覆盖 100%，主题/ACL 最小权限生效。
- 提升席位效率与稳定性：多窗口并开仍 ≥60 FPS；关键看板切换/组订阅到可见更新 ≤ 500ms。
- 降低资源成本：单用户仅 1 条 WS 连接；每活跃组下行 ≤ 2 Mbps；显式慢消费者与降级策略闭环。
- 强化可观测性与运维：端到端指标可视化，SLO 违约占比 < 1% 交易时段；异常可在 15 分钟内定位到链路与组件。

### User Success Metrics

- 热点定位与切换：从搜索/勾选到面板可见更新 ≤ 0.5s。
- 交互流畅度：滚动/筛选/展开列表操作 95% 响应时间 < 100ms。
- 断线恢复：网络异常后自动重连并恢复订阅 ≤ 3s；用户无需手动干预。
- 操作连续性：4–5 窗口并开场景下无明显掉帧或“卡点不动”。
- 观测闭环：用户能在 UI 中查看帧率、延迟、带宽等关键指标并上报问题。

### Key Performance Indicators (KPIs)

1. 帧时与帧率：rAF 帧 p95 < 16.7ms、p99 < 25ms；FPS ≥ 60。
2. 行情端到端延迟：P95 < 120ms、P99 < 180ms（adapter→聚合→WS→UI 渲染）。
3. 连接与订阅：单用户 WS 连接数 = 1；组订阅到可见更新 ≤ 500ms。
4. 网络与丢帧：每活跃组下行 ≤ 2 Mbps；丢帧/合并帧率 ≤ 0.1%。
5. 可靠性：慢消费者告警 ≤ 1 次/小时；断线重连恢复 ≤ 3s。

---

## Strategic Alignment and Financial Impact

### Financial Impact

- 软硬件成本：单连接扇出与“增量+快照”裁剪，峰时下行带宽预期下降 30–60%；前端 CPU/内存峰值下降 20–40%。
- 交付效率：Schema Registry 与代码生成减少跨端改动面与联调时间，新增字段/面板的交付周期缩短 30%+。
- 运维开销：慢消费者/延迟指标闭环，定位时间（MTTR）目标 < 15 分钟；减少交易时段 SLO 违约与人工排障。

### Company Objectives Alignment

- 平台化与工程化：统一消息总线与协议治理，降低技术债与系统分叉。
- 稳定与合规：JetStream 审计回放与最小权限 Subject ACL，提升可追溯与风控透明度。
- 效率与扩展：标准接口与指标体系，支持多团队并行与多市场扩展。

### Strategic Initiatives

- 消息与 Schema 中台：Registry、兼容测试、TS/Python 代码生成流水线。
- 可观测性中台：统一指标/告警模板与压测脚本仓库，内置异常模式注入。
- 席位组件库：高性能列表/图表/账户与风险面板组件复用。

---

## MVP Scope

### Core Features (Must Have)

- 聚合器（Aggregator）服务：
  - 输入 `md.raw.*`，输出 `md.agg.33ms.<group>`（FlatBuffers 增量）与 `md.snapshot.<group>`（Protobuf 周期快照）。
  - ROI 字段裁剪 + Top‑K；按“行/字节/毫秒”预算自适应批大小与频率；`group.update` 组成员变更（250–500ms 去抖）。
- NATS‑WS 网关：
  - 单用户仅 1 条 WS 连接；慢消费者检测与处理；断线重连与自动恢复订阅；JWT/NKey 鉴权与 Subject ACL。
- Schema 治理与代码生成：
  - Protobuf（快照）与 FlatBuffers（增量）统一定义；Schema Registry；TS/Python 代码生成流水线；“仅追加”兼容策略。
- 前端连接与解码：
  - SharedWorker 维持单连接 → BroadcastChannel 扇出到多标签页；Worker 解码二进制 → SoA TypedArray 环形缓冲。
- 渲染与交互：
  - OffscreenCanvas/Canvas 虚拟化列表；rAF 对齐的增量批量绘制；可视行约 100 行的平滑滚动与筛选。
- 指令与辅助通道：
  - 交易指令使用 NATS 请求‑应答（幂等 id、超时/重试）；账户/风险 1–2s 节奏更新；异常/告警最小闭环。
- 可观测性与指标：
  - UI 覆盖 FPS、rAF 帧时 p95/p99、端到端延迟、下行带宽、丢帧/合并帧、慢消费者事件等；最小化仪表盘。
- 数据模拟与压测：
  - 负载发生器用于 2k avg / 4k peak tick/s；基线脚本与报告。

### Out of Scope for MVP

- 前端长历史本地回放与复杂审计 UI（保留 JetStream 服务端能力与后端回放）。
- WebGPU 深度可视化、复杂热力/密度图统一渲染（可用 Canvas 近似替代）。
- SharedArrayBuffer/COOP/COEP 全链路启用（作为 Phase 2 选项）。
- 高级风控/Greeks 深度计算前置到前端；跨区域/公网复杂网络场景。
- 完整 RBAC/多租户门户与精细化审计流水 UI（仅做最小权限与鉴权）。
- 完整 APM/日志聚合/告警平台集成（以最小可观测闭环为主）。

### MVP Success Criteria

- 性能与延迟：UI ≥ 60 FPS；端到端延迟 P95 < 120ms、P99 < 180ms（在 4–5 窗口并开、4k tick/s 峰值负载下）。
- 网络与连接：单用户 WS 连接数 = 1；每活跃组下行 ≤ 2 Mbps；慢消费者可见并可缓解。
- 交互与可用性：勾选/搜索更新组订阅 → 可见更新 ≤ 0.5s；滚动/筛选 95% 响应 < 100ms；断线恢复 ≤ 3s。
- 治理与兼容：Schema Registry 覆盖 100%；“仅追加”策略通过变更演练；TS/Python 代码生成产物用于前后端。
- 可观测性：关键指标可视化并留存报告；SLO 违约占比 < 1% 的交易时间。

---

## Post-MVP Vision

### Phase 2 Features

- SharedArrayBuffer + WASM/Simd：加速 FBS 解码与零拷贝传递。
- WebGPU/OffscreenCanvas：统一热力/密度图渲染通道。
- JetStream 回放：交易日/窗口级受控回放与审计检索。
- 策略/风控可视化：以 NATS 事件暴露 algo 状态与阈值事件。
- 智能 ROI/Top‑K：基于活跃度与可视区域自适应裁剪。
- 端到端压测：场景脚本、自动化报告与异常注入。

### Long-term Vision

- 统一席位平台：多市场多券商接入、细粒度权限与合规。
- 治理与合规：Schema 变更流程联动审计与留存策略。
- 智能降级：指标驱动自适应产流/绘制维持 SLO。
- 生态开放：以 NATS 主题与合约为标准接口。

### Expansion Opportunities

- 市场扩展、多租户隔离、跨地域部署。
- 复盘与研究：盘后归因与策略诊断工具。
- 运营自动化：异常检测/容量预测/成本优化。

---

## Technical Considerations

### Platform Requirements

- 现状：Windows 7+/Windows Server 2008+；Python 3.7（64位，推荐 VNStudio-2.1.6）；内网环境。
- 依赖：PyQt5、PyQtWebEngine、TA‑Lib、QuickFIX（预编译whl）、pyzmq、numpy/pandas、peewee/pymysql/psycopg2/mongoengine 等。
- 本地网关与网卡：低抖动千兆以太网；席位多屏显示（60Hz）。

### Technology Preferences

- 后端消息：从 ZeroMQ（CURVE）迁移到 NATS（请求‑应答 + 发布‑订阅 + JetStream）。
- 序列化：快照采用 Protobuf，增量采用 FlatBuffers；Schema Registry + TS/Python 代码生成。
- 前端：Web（Worker + OffscreenCanvas/Canvas），单连接 SharedWorker 扇出；可选 WASM/SharedArrayBuffer（Phase 2）。
- 重写取向：不引入 ZMQ↔NATS 兼容层作为必选项；仅参考旧逻辑的数据与领域模型，直接面向 NATS 协议与 Web 端。

### Architecture Considerations

- 现有形态（来自 yueweioption_xiaoydb，供参考，不直接复用）：
  - 桌面端：PyQt 客户端（xy 模块），多进程 RPC（vnpy.app.rpc_service），本地 LocalGateway → 行情/交易网关（CTP/SOPT/UFT 等）。
  - RPC 模式：vnpy.rpc 基于 ZeroMQ（REP/REQ + PUB/SUB，CURVE 认证）。
  - 数据/日志：DbLogManager/RecordManager，含 ZMQ pub/sub 缓存，支持 MySQL/Postgres/Mongo 等。
- 稳定接口边界（保留/参考，不变更业务语义）：
  - 交易账户 API：保持既有账户与网关 API 语义不变（CTP/SOPT/UFT/SEC 等），在 NATS 命令通道侧做适配层。
  - Option 领域：保留 OptionMaster 的组合/定价/希腊值领域模型与配置语义。
  - Portfolio_generate / algo / account_manager：保留生成与运行语义，在新事件总线上暴露状态与控制面。
- 重写路线（Greenfield）：
  - R1 核心通道：直接实现聚合器（33ms 增量/Proto 快照）与 NATS‑WS；域模型与主题规范一次到位（md.agg.33ms.<group> / group.update / acct.status / acct.risk / order.req）。
  - R2 前端：从零构建 Web 客户端（单连接 SharedWorker 扇出 + Worker 解码 + OffscreenCanvas 列表/图表），不落地 PyQt UI；提供最小席位功能。
  - R3 账户与风控：对接现有网关/账户服务的“只读”REST/NATS 接口；交易指令走 NATS 请求‑应答，取消旧 RPC 依赖。
  - R4 观测与治理：统一指标（FPS、延迟、丢帧、带宽、慢消费者）与告警；Schema Registry 与代码生成流水线齐备。

---

## Constraints and Assumptions

### Constraints

- 平台绑定：大量 Windows 定制依赖（PyQt、wmi、QuickFIX、TA‑Lib 预编译 whl、pybind11 扩展等）。
- Python 版本：当前代码与发行版面向 Python 3.7；部分二进制轮子存在 cp37/cp310 混合，需要兼容策略或分阶段升级。
- RPC 形态：依赖 ZeroMQ（CURVE），广泛存在于 vnpy.rpc 与分析缓存（dblog_pub/sub）。
- 网络与安全：内网场景，需替换等效的鉴权与 ACL（NATS NKey/JWT + Subject ACL）。
- UI 形态：现为 PyQt 桌面端，多窗口/多标签页资源复用受限。

### Key Assumptions

- 可在短期内并行运行 PyQt 客户端与 Web 前端，共享同一聚合/账户/风险数据源。
- 允许引入 ZMQ↔NATS 兼容网关作为过渡，不要求“一键切换”。
- 席位硬件满足 60 FPS + 单连接扇出方案（浏览器与网卡稳定）。
- 关键交易网关（CTP/SOPT/UFT/SEC 等）继续通过既有适配器接入；Web 侧仅做控制与可视化。

---

## Risks and Open Questions

### Key Risks

- 迁移期双栈复杂度：ZMQ 与 NATS 并存导致事件重复/顺序处理复杂，需去抖与一致性设计。
- UI 性能风险：Web 端在峰值 4k tick/s 与 4–5 窗口并开下的绘制与 GC 抖动。
- 权限与网关安全：Subject ACL 映射不当可能导致越权或错配；CURVE→NKey/JWT 的迁移策略需验证。
- 依赖升级：Python 与第三方二进制库升级的不确定性（ABI/轮子可用性）。

### Open Questions

- 现网账户与网关：实际接入的券商/网关矩阵（CTP/SOPT/UFT/SEC）与占比？
- 最小可替换单元：是否需要“ZMQ→NATS 兼容网关”先行，优先替换行情快路径，命令通道后置？
- 数据存储与回放：MySQL/Postgres/Mongo 当前实际使用比例？是否需要统一为 JetStream + 轻量索引？
- 席位与网络：交易席位的 CPU/内存/显卡/网卡标准化参数？是否需要 COOP/COEP（SharedArrayBuffer）？
- 合规与审计：是否存在必须保留的本地日志/审计流水与保留期要求？

### Areas Needing Further Research

- ZMQ↔NATS 兼容桥接网关设计（主题映射、ACK 语义、背压与重连策略）。
- ROI 字段策略与 Top‑K 裁剪算法的业务阈值与容忍度。
- 浏览器端 SoA 管线与 WASM/FBS 解码的基准测试与取舍。
- NKey/JWT 与现有用户/账户映射的落地方案。

---

## Appendices

### A. Research Summary

- 头脑风暴结论（2025-10-17，docs/brainstorming-session-results-2025-10-17.md）
  - 主题：高频行情前端方案；目标承载 ~2k avg / 4k peak tick/s。
  - 技术主线：33–50ms 微批 + rAF 帧对齐渲染；ROI 字段与 Top‑K；SharedWorker 单连接扇出；Worker 解码 → SoA 环形缓冲；OffscreenCanvas 批绘。
  - 通道与语义：行情广播与交易请求‑应答解耦；at‑most‑once 实时路径 + JetStream 审计旁路。
  - SLO 建议：FPS ≥60；端到端 P95 <120ms/P99 <180ms；每活跃组 ≤2 Mbps；慢消费者可见。

- 架构草图（docs/brainstorming-arch-2025-10-17.md）
  - 数据链路：adapter → NATS → Aggregator（FBS 增量/Proto 快照）→ NATS‑WS → SharedWorker → Tab Worker → UI。
  - 服务：Risk/Greeks、Order Router（NATS 请求‑应答）、JetStream（归档/回放）。

- 执行清单（PoC，两周，docs/brainstorming-execution-checklist-2025-10-17.md）
  - 交付物：聚合器、WS 网关、Schema/代码生成、数据模拟器、前端 Demo、指标仪表。
  - 校验场景：100 可见行、4–5 窗口、10 名交易员；SLO 与网络/CPU 预算明确。

- 项目状态（docs/bmm-workflow-status.md）
  - 建议在 Analysis 后进入产品简报与规划；语言/团队约束记录。

- 参考代码库（/yueweioption_xiaoydb，2025-10-20 扫描）
  - 现状：PyQt5 桌面端、ZeroMQ RPC（CURVE）、多网关接入（CTP/SOPT/UFT/SEC）、Option/Account/Algo 模块完善。
  - 结论：将保留其账户 API、Option、Portfolio_generate、algo、account_manager 的语义与行为作为新系统参考。

### B. Stakeholder Input

- 2025-10-20（ryan）：项目采用“从零重写（Greenfield）”，不做渐进迁移。
- 稳定不变的接口/领域：
  - 交易账户 API 不变（网关接入语义保持）。
  - Option 相关模块不变（OptionMaster 领域模型、配置与计算）。
  - Portfolio_generate、algo、account_manager 基本不变（生成与运行语义保持）。
- 目标：直接面向 NATS 协议与 Web 前端；旧库仅作逻辑参考，不引入 ZMQ↔NATS 兼容层作为必选项。

### C. References

- docs/brainstorming-session-results-2025-10-17.md
- docs/brainstorming-arch-2025-10-17.md
- docs/brainstorming-execution-checklist-2025-10-17.md
- docs/bmm-workflow-status.md
- /yueweioption_xiaoydb（本地代码库快照）

---

_This Product Brief serves as the foundational input for Product Requirements Document (PRD) creation._

_Next Steps: Handoff to Product Manager for PRD development using the `workflow prd` command._
