# 管理层执行摘要（三页版）：xiaoy

日期：2025-10-20
作者：ryan
状态：供管理层审阅/决策

—— 目标：3页内回答“做什么、为谁、为什么现在、如何检验成功与何时交付”。

---

一、产品概念（What）
- 基于 NATS 的下一代 Web 交易席位，用于承载高吞吐行情与账户/风控的低延迟交互。
- 服务端聚合通道输出“33ms 增量 + 2–5s 快照”；浏览器端采用“单连接 SharedWorker 扇出 + Worker 解码 + OffscreenCanvas 批量绘制”。
- 定位：从零重写（Greenfield），不做渐进迁移；参考现有 yueweioption_xiaoydb 的领域与接口语义。

二、核心问题（Why）
- 现状（PyQt/ZMQ）在 4k tick/s 峰值与 4–5 窗口并发时难以稳定达到低延迟、低抖动、可观测目标，影响盘中操作与风控效率。
- 问题本质：
  - 多标签多连接造成带宽与解码重复；
  - 渲染在主线程拥塞，逐 tick 更新导致掉帧；
  - 行情与交易命令耦合，背压互相影响；
  - 监控与告警不完善，故障定位慢。

三、目标用户（Who）
- 自营/量化交易员与风控人员（内网、多屏席位，需并发监控多组合约与账户状态）。
- 次要用户：运维/平台（慢消费者与链路指标可视）、合规/运营（JetStream 审计/回放）。

四、成功标准（Outcomes & KPIs）
- 交互体验：≥60 FPS；端到端延迟 P95 < 120ms、P99 < 180ms。
- 网络/连接：单用户仅 1 条 WS 连接；每活跃组下行 ≤ 2 Mbps；慢消费者可见且可缓解。
- 可用性：组订阅变更 → 可见更新 ≤ 0.5s；断线恢复 ≤ 3s；95% 交互响应 < 100ms。
- 治理与演进：Schema Registry + TS/Python 代码生成；“仅追加”兼容；关键指标/告警闭环可观测。

五、MVP范围（Must Have）
- 聚合器：输入 md.raw.* → 输出 md.agg.33ms.<group>（FlatBuffers 增量）与 md.snapshot.<group>（Proto 快照）；ROI 字段裁剪 + Top‑K；自适应批次与频率；group.update 250–500ms 去抖。
- NATS‑WS 网关：单连接、慢消费者处理、断线重连与订阅恢复；NKey/JWT + Subject ACL。
- Web 客户端：SharedWorker 单连接扇出；Worker 解码 → SoA 环形缓冲；OffscreenCanvas 列表与关键图表增量绘制。
- 指令与风控：交易指令走 NATS 请求‑应答（幂等 id、超时/重试）；账户/风险 1–2s 节奏更新。
- 可观测性：FPS、rAF 帧分位、端到端延迟、带宽、丢帧/合并帧、慢消费者事件；最小仪表与日志。
- 数据模拟与压测：2k avg / 4k peak tick/s 发生器；场景脚本与自动化报告。

六、非目标（Out of Scope for MVP）
- 本地长历史回放与复杂审计 UI（保留 JetStream 服务端能力）。
- WebGPU 深度可视化、SharedArrayBuffer 全链路启用（列入 Phase 2）。
- 完整 RBAC/门户/精细审计流水；完整 APM 平台集成（先最小闭环）。

七、技术方向与重写原则（How）
- 重写取向：直接面向 NATS + Web，不引入 ZMQ↔NATS 兼容层作为必选项。
- 稳定接口边界（保留语义）：交易账户 API、Option 领域（OptionMaster）、Portfolio_generate、algo、account_manager。
- 序列化：快照 Proto、增量 FBS；Schema Registry 与代码生成（TS/Python）。
- 架构关键：快路径实时 at‑most‑once + JetStream 审计旁路；慢消费者/降级策略内建。

八、交付里程碑（When）
- M0（本周）：Schema 与主题规范草案、PoC 计划与验收清单冻结。
- M1（+1 周）：聚合器 + NATS‑WS + 数据模拟器打通；客户端单连接/Worker 解码/列表增量绘制；首版指标可视。
- M2（+2 周）：MVP 验收（≥60 FPS、P95 < 120ms；4–5 窗口；单连接；≤2 Mbps/组）；异常注入与降级策略验证。
- M3（+3–4 周）：策略/风控可视、账户联通、最小下单闭环；PoC 报告与产品化路线评审。

九、风险与缓解（Risks & Mitigations）
- UI 性能抖动：使用 Worker 解码、SoA 环形缓冲、rAF 批绘与降级策略（降采样/合并帧/Top‑K）。
- 双栈复杂度：不走双栈；旧库仅作语义参考，避免 ZMQ 与 NATS 并存导致一致性问题。
- 依赖升级：限定浏览器/席位硬件基线；第三方库用稳定版本，必要时自建轮子/镜像。
- 权限错配：以 Subject ACL 最小权限与审计策略，统一鉴权与主题命名。

十、财务与效益（Financial Impact）
- 成本：单连接与“增量+快照”裁剪预计峰时下行带宽降 30–60%，前端 CPU/内存峰值降 20–40%。
- 交付效率：Schema/代码生成减少跨端改动与联调，新增字段/面板交付周期缩短 30%+。
- 运维：慢消费者与延迟指标闭环，MTTR 目标 < 15 分钟；交易时段 SLO 违约工单下降。

十一、决策请求（Asks）
- 确认“从零重写（Greenfield）”方向与成功指标（FPS/延迟/带宽/订阅时延）。
- 批准稳定接口边界：交易账户 API、Option、Portfolio_generate、algo、account_manager 的业务语义保持不变。
- 批准两周 PoC 里程碑（M1/M2）与验收清单；锁定必要资源（前端 1、后端 1、全栈/运维 0.5）。
- 允许在内网预留 NATS 与 JetStream 基础设施与监控指标接入。

十二、后续展望（Phase 2 / Long‑term）
- SharedArrayBuffer + WASM/Simd、WebGPU 统一渲染、JetStream 回放、策略/风控可视化、智能 ROI/Top‑K、自助压测平台。

---

附：关键验收门槛（MVP）
- UI ≥60 FPS；端到端延迟 P95 < 120ms / P99 < 180ms；单用户一条 WS；每活跃组 ≤ 2 Mbps；组订阅到可见更新 ≤ 0.5s；断线恢复 ≤ 3s。

