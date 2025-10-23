# xiaoy - Epic Breakdown

**Author:** ryan
**Date:** 2025-10-20
**Project Level:** 3
**Target Scale:** Production

---

## Overview

This document provides the detailed epic breakdown for xiaoy, expanding on the high-level epic list in the PRD.

Each epic includes:

- Expanded goal and value proposition
- Complete story breakdown with user stories
- Acceptance criteria for each story
- Story sequencing and dependencies

**Epic Sequencing Principles:**

- Epic 1 establishes foundational infrastructure and initial functionality
- Subsequent epics build progressively, each delivering significant end-to-end value
- Stories within epics are vertically sliced and sequentially ordered
- No forward dependencies - each story builds only on previous work

---

### Single Persona Mode

本项目采用“单一角色（Trader）”策略：
- 一切可见功能与验收均以 Trader 的效率与稳定为唯一衡量标准。
- 过去文档中出现的“平台/运维、风控/运营、策略工程师”等，只作为“系统使能（Enabler）”职责，不作为独立人物角色。
- Enabler 故事用于交付工程底座（观测、CI、契约治理等），其价值表述为“服务 Trader 的稳定与效率”。

---

## Epic 1: 基础设施与单连接骨架（Foundation & Single-Connection）

Expanded Goal
- 建立可部署基础设施（仓库/CI、配置、特性开关），实现 NATS→WS 网关与单连接 SharedWorker 扇出骨架，落地端到端观测与最小可见面板，为后续 UI/策略模块提供稳定底座。

Story Breakdown

**Story 1.1: 仓库与 CI 基线**
Enabler — 仓库与 CI 基线
I want a repo + CI skeleton,
So that I can build/format/test and gate changes consistently.
Trader 价值：缩短迭代与修复时间，减少回归导致的交易时段中断。
Acceptance Criteria:
1. CI 运行 lint/format/unit 构建；主干保护与 PR 检查启用。
2. 基础目录与环境变量、特性开关就绪。
3. 模板 README 与贡献指南可用。
Prerequisites: —

**Story 1.2: NATS→WS 网关最小链路**
Enabler — NATS→WS 网关最小链路
I want a minimal NATS→WS gateway,
So that browser can consume normalized topics.
Trader 价值：稳定单连接数据通路与更清晰错误反馈，减少看盘/下单中断。
Acceptance Criteria:
1. 连接 NATS 并将选定 subject 映射到 WS；TLS + JWT/NKey 验证。
2. 指标：连接数、消息速率、慢消费者计数导出。
3. 错误与超时有明确错误码与日志。
Prerequisites: 1.1

**Story 1.3: 单连接 + SharedWorker 骨架**
Enabler — 单连接 SharedWorker 扇出骨架
I want a SharedWorker single-connection fanout,
So that tabs share one WS and subscriptions.
Trader 价值：多标签一致且更流畅，降低资源占用与掉帧。
Acceptance Criteria:
1. 单条 WS 连接建立，BroadcastChannel/MessagePort 扇出至多标签。
2. 订阅在 SharedWorker 合并/去重（16–33ms 批处理）。
3. 断线指数回退 + 并发上限；自检报告。
Prerequisites: 1.2

**Story 1.4: 契约与代码生成（Proto/FBS + Registry）**
Enabler — 契约与代码生成（Proto/FBS + Registry）
I want schemas with codegen,
So that client/server evolve safely with append-only policy.
Trader 价值：减少版本不兼容导致的异常与停摆，提升变更可预期性。
Acceptance Criteria:
1. 快照 Proto、增量 FBS 基线与版本策略；CI 仅追加检查。
2. 生成 TS/Python 代码；未知字段容忍并打点。
3. 兼容测试样例覆盖。
Prerequisites: 1.1

**Story 1.5: 端到端观测与指标浮层钩子**
Enabler — 端到端观测与指标浮层钩子
I want end-to-end metrics,
So that I can see p50/p95/p99 and slow consumer events.
Trader 价值：异常能被快速发现并自动/手动降级，保持可用与顺畅。
Acceptance Criteria:
1. adapter→aggregator→WS→UI 埋点；Prometheus/OpenTelemetry 导出。
2. 前端指标 API 可被 UI 浮层消费。
3. SLO 阈值与错误预算配置就绪。
Prerequisites: 1.2, 1.3

**Story 1.6: 最小可见面板（占位列表/图表）**
As a trader,
I want a minimal panel,
So that I can verify rendering and latency budget.
Acceptance Criteria:
1. OffscreenCanvas 增量绘制列表/简单图表；渲染预算每帧 ≤ 8ms。
2. FPS/端到端延迟/带宽可视。
3. 降级策略开关可触发与恢复。
Prerequisites: 1.3, 1.5

> 注：实施拆分出内部里程碑“1.6a 集成骨架”，用于端到端编排与最小 E2E 校验的门槛化交付；该编号仅用于实施追踪，不改变正式排序与编号。

**Story 1.7: 运维仪表盘与 SLO/错误预算**
Enabler — 运维仪表盘与 SLO/错误预算
I want an ops dashboard with SLO/SLI budgets,
So that I can catch burn-rate breaches early.
Trader 价值：交易时段稳定性提升，突发问题能更快恢复与回到正常。
Acceptance Criteria:
1. 展示 p50/p95/p99、慢消费者、重连/订阅风暴计数与错误预算燃尽；
2. 按环境/面板/分组过滤；
3. 阈值可配置并与告警联动（NFR004）。
Prerequisites: 1.5

---

## Epic 2: 虚拟账户监控（Virtual Account Monitor）

Expanded Goal
- 提供虚拟账户资金、持仓、盈亏与网关状态监控；支持选择虚拟网关参与策略下单，形成账户→组合→下单的闭环入口。

Story Breakdown

**Story 2.1: 虚拟网关接入与权限**
Enabler — 虚拟网关接入与权限
I want virtual gateway integration,
So that I can view/select gateways for simulated trading.
Trader 价值：可用网关一目了然，避免误选导致下单失败。
Acceptance Criteria:
1. 列出可用虚拟网关与状态；Subject ACL 最小权限。
2. 选择/取消选择影响后续策略下单可用网关。
3. 指标：连接与心跳健康度。
Prerequisites: 1.2

**Story 2.2: 资金与盈亏面板**
As a trader,
I want account balance and PnL panel,
So that I can assess readiness and risk.
Acceptance Criteria:
1. 资金、权益、可用、当日/累计盈亏展示；格式化与颜色提示。
2. 列表支持排序/过滤；大数据量不掉帧。
3. 指标埋点就绪。
Prerequisites: 2.1, 1.6

**Story 2.3: 持仓与风险概览**
As a trader,
I want positions overview,
So that I can monitor exposure.
Acceptance Criteria:
1. 合约、数量、方向、均价、浮动盈亏、保证金等字段；
2. 大列表虚拟化渲染；
3. 告警阈值与高亮。
Prerequisites: 2.2

**Story 2.4: 账户→下单联动**
As a trader,
I want gateway selection to feed ordering,
So that selected gateways are used by algo ordering.
Acceptance Criteria:
1. 虚拟账户面板中的选择在“策略下单”可见；
2. 不可用状态时下单面板禁用并提示。
3. 审计记录切换动作。
Prerequisites: 2.1, 2.2

**Story 2.5: 表格性能与错误处理**
Enabler — 表格虚拟化与错误处理
I want table virtualization and robust errors,
So that UI remains smooth under load.
Trader 价值：高负载下仍流畅操作，错误提示一致可理解。
Acceptance Criteria:
1. 1–2 万行场景仍流畅滚动；
2. 超时/异常有统一错误提示与重试；
3. 慢消费者触发降级并记录事件。
Prerequisites: 2.2, 1.5

**Story 2.6: 账户操作审计与导出**
Enabler — 账户操作审计与导出
I want account action audit and export,
So that I can trace changes and comply with reviews.
Trader 价值：账户操作可追溯，问题定位与复盘更高效。
Acceptance Criteria:
1. 账户选择/切换、阈值调整、下单网关勾选等关键操作留痕；
2. 过滤并导出 CSV/JSON（保留 ≥90 天，见 NFR003）；
3. 权限控制与红线字段脱敏。
Prerequisites: 2.1

---

## Epic 3: 手选T型报价与核心可视（Manual T-Shape Quotes）

Expanded Goal
- 交付手选T型报价可视与交互（T 型矩阵、ROI 字段、Top‑K），提供搜索/筛选与键鼠快捷操作，支撑增量渲染与性能目标。

Story Breakdown

**Story 3.1: T 型矩阵网格**
As a trader,
I want a T-shape grid,
So that I can inspect options surface quickly.
Acceptance Criteria:
1. 行列映射到到期/行权价；
2. 渲染采用增量绘制与虚拟化；
3. 可固定头/列，支持快速滚动。
Prerequisites: 1.6

**Story 3.2: ROI 字段与 Top‑K 控件**
As a trader,
I want ROI/Top-K controls,
So that I can focus on the most relevant contracts.
Acceptance Criteria:
1. ROI 字段选择；Top‑K、过滤与排序；
2. ≤500ms 到可见更新；
3. 控件状态可保存与灰度。
Prerequisites: 3.1, 1.5

**Story 3.3: 搜索与快捷键**
As a trader,
I want search and hotkeys,
So that I can operate efficiently.
Acceptance Criteria:
1. 搜索定位与高亮；键盘导航与常用快捷；
2. 可配置；
3. 指标埋点。
Prerequisites: 3.2

**Story 3.4: 指标浮层与降级联动**
Enabler — 指标浮层与降级联动
I want a metrics overlay,
So that I can see FPS/latency/bandwidth and trigger degrade.
Trader 价值：实时看到性能状态并一键降级，保障交互流畅。
Acceptance Criteria:
1. 浮层展示 FPS/端到端/带宽与慢消费者；
2. 一键触发采样/裁剪/停更；
3. 恢复条件明确并可操作。
Prerequisites: 1.5, 3.1

**Story 3.5: 去抖与批处理**
Enabler — 去抖与批处理
I want dedupe/batch updates,
So that subscription storms are mitigated.
Trader 价值：切换订阅时更稳、更快，降低卡顿。
Acceptance Criteria:
1. SharedWorker 侧 16–33ms 批量合并；
2. 网关最小间隔节流；
3. 指标可见。
Prerequisites: 1.3

---

## Epic 4: 自动生成与自动解析（Auto Generator & Auto Parsing）

Expanded Goal
- 提供参数化自动生成与“信号→方案”自动解析能力；支持方案保存/编辑与一键带入策略参数，连通至策略下单链路。

Story Breakdown

**Story 4.1: 自动生成参数面板与计算**
As a trader,
I want auto generator parameters,
So that I can quickly get suggested portfolios.
Acceptance Criteria:
1. 参数：到期、Delta 区间、方向、数量等；
2. 生成/清空与结果表格；
3. 性能预算达标。
Prerequisites: 3.1

**Story 4.2: 信号→方案解析视图**
As a trader,
I want to parse external signals into schemes,
So that I can turn intent into executable settings.
Acceptance Criteria:
1. 信号输入区与方案编辑区；
2. 一键解析并回显生成器模板 + 算法参数；
3. 错误提示与校验。
Prerequisites: 4.1

**Story 4.3: 方案保存/编辑/删除**
As a trader,
I want to manage schemes,
So that I can reuse and iterate easily.
Acceptance Criteria:
1. 列表展示方案；
2. 增改删与双击复制；
3. 行高自适应多行文本。
Prerequisites: 4.2

**Story 4.4: 一键带入策略参数**
As a trader,
I want to ingest scheme into ordering,
So that I can place orders with minimal edits.
Acceptance Criteria:
1. 方案一键带入 Algo 参数；
2. 校验必填项与边界；
3. 回执与错误提示清晰。
Prerequisites: 4.3, 2.4

**Story 4.5: 方案库（导入/导出/预设模板）**
As a trader,
I want import/export and preset templates,
So that I can reuse and share schemes safely.
Acceptance Criteria:
1. JSON 导入/导出方案并校验字段；
2. 内置预设模板（可禁用/灰度）；
3. 版本与兼容性提示（结合 TD-003）。
Prerequisites: 4.3

**Story 4.6: 方案校验与静态试算（Dry‑run）**
As a trader,
I want parameter validation and dry-run hints,
So that I can reduce misconfiguration.
Acceptance Criteria:
1. 参数边界校验与必填检查；
2. 基于当前行情快照的静态指标提示（例如名义敞口/保证金估计）；
3. 明确与生产下单隔离（只读试算，不产生真实委托）。
Prerequisites: 4.1, 4.2

---

## Epic 5: 策略下单与算法执行集成（Algo Ordering & Execution）

Expanded Goal
- 交付策略下单面板（模板 Tab + 参数表），实现请求‑应答幂等、订单回执/失败回退与审计；提供算法监控视图，联动虚拟账户与可观测指标。

Story Breakdown

**Story 5.1: 策略下单面板 UI**
As a trader,
I want an ordering panel,
So that I can select template and parameters easily.
Acceptance Criteria:
1. 模板 Tab 与参数表；
2. 校验与默认值；
3. 可视化回执区域。
Prerequisites: 4.4

**Story 5.2: 幂等请求‑应答客户端**
Enabler — 幂等请求‑应答客户端
I want idempotent request-reply client,
So that duplicate submissions are prevented.
Trader 价值：避免重复下单与“假成功”，提交更安心。
Acceptance Criteria:
1. 幂等键生成；
2. 超时/重试上限与错误码；
3. 审计打点。
Prerequisites: 1.2, 1.4

**Story 5.3: 算法监控视图**
Enabler — 算法监控视图
I want an algo monitor,
So that I can observe and control running algos.
Trader 价值：运行中策略状态清晰，可快速暂停/停止与定位异常。
Acceptance Criteria:
1. 列表展示状态/进度/异常；
2. 暂停/停止控制；
3. 日志聚合与筛选。
Prerequisites: 5.1

**Story 5.4: 错误映射与回退策略**
As a trader,
I want clear error mapping and fallback,
So that I can recover quickly.
Acceptance Criteria:
1. 统一错误码与提示；
2. 可回退流程（重试/人工确认/终止）；
3. 审计留痕。
Prerequisites: 5.2

**Story 5.5: 风险告警联动**
As a trader,
I want deep links from alerts,
So that I can jump to context and act.
Acceptance Criteria:
1. 告警点击直达相关标的/组合；
2. 处置动作（降级/保真/调整订阅）；
3. 处置结果留痕。
Prerequisites: 2.3, 3.4

**Story 5.6: 降级策略与会话恢复集成**
Enabler — 降级策略与会话恢复集成
I want degrade and recovery integrated,
So that system stays usable under load.
Trader 价值：在高负载/断线时仍可用，自动恢复会话。
Acceptance Criteria:
1. 采样/裁剪/停更策略与 UI 控件联动；
2. 断线恢复 ≤ 3s，版本不一致自动全量快照；
3. 指标与告警闭环。
Prerequisites: 1.5, 1.6

**Story 5.7: 风险阈值编辑与告警路由**
Enabler — 风险阈值编辑与告警路由
I want threshold editor and alert routing,
So that I can tune alerts and reduce noise.
Trader 价值：告警更精准，减少噪音干扰与误触。
Acceptance Criteria:
1. 可配置阈值与屏蔽规则；
2. 路由到通知通道（邮件/IM/日志）并支持抑制窗口；
3. 变更留痕与回滚。
Prerequisites: 2.3, 3.4

---

## MVP 交付清单（建议顺序）

为避免贪大从难，以下为最小可用交付（MVP）建议顺序，仅围绕 Trader 的看盘与最小下单闭环：

1) [ ] Story 1.1 仓库与 CI 基线（Enabler）
2) [ ] Story 1.4 契约与代码生成（Enabler）
3) [ ] Story 1.2 NATS→WS 网关最小链路（Enabler）
4) [ ] Story 1.3 单连接 + SharedWorker 骨架（Enabler）
5) [ ] Story 1.5 端到端观测与指标浮层钩子（Enabler）
6) [ ] Story 1.6 最小可见面板（Trader）
7) [ ] Story 5.1 策略下单面板 UI（Trader）
8) [ ] Story 5.2 幂等请求‑应答客户端（Enabler）
9) [ ] Story 5.4 错误映射与回退策略（Trader）
10) [ ] Story 5.6 降级策略与会话恢复集成（Enabler）

> 说明：
> - 账户与持仓等完整可视（Epic 2）与 T 型矩阵/ROI/搜索（Epic 3）放入下一阶段；MVP 仅需最小面板验证端到端指标与下单闭环。
> - 若交付评审认为需要账户只读可见，可将 Story 2.2（资金与盈亏面板）作为“可选增强”插入第 6 步之后。

### Post‑MVP 优先队列

- Story 2.2 资金与盈亏面板（Trader）
- Story 2.3 持仓与风险概览（Trader）
- Story 2.4 账户→下单联动（Trader）
- Story 3.1 T 型矩阵（Trader）
- Story 3.2 ROI 字段与 Top‑K 控件（Trader）
- Story 3.3 搜索与快捷键（Trader）
- Story 5.3 算法监控视图（Enabler）
- Story 5.5 风险告警联动（Trader）
- Story 2.6 账户操作审计与导出（Enabler）
- Story 1.7 运维仪表盘与 SLO/错误预算（Enabler）

---

## Story Guidelines Reference

**Story Format:**

```
**Story [EPIC.N]: [Story Title]**

As a [user type],
I want [goal/desire],
So that [benefit/value].

**Acceptance Criteria:**
1. [Specific testable criterion]
2. [Another specific criterion]
3. [etc.]

**Prerequisites:** [Dependencies on previous stories, if any]
```

**Story Requirements:**

- Vertical slices - Complete, testable functionality delivery
- Sequential ordering - Logical progression within epic
- No forward dependencies - Only depend on previous work
- AI-agent sized - Completable in 2–4 hour focused session
- Value-focused - Integrate technical enablers into value-delivering stories

Enabler Story Option（用于工程使能项）
- 允许使用“Enabler — [能力名称]”替代传统的“As a [user]”句式。
- 其余格式（验收标准/先决条件）保持一致，且需明确“对 Trader 的直接价值”。

---

**For implementation:** Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.
