# Cohesion Check Report

Scope: Validate coverage of FRs/NFRs/epics/stories; detect vagueness/over‑spec; ensure architecture is implementation‑ready.

## Summary

- FR coverage: 22/22 (100%)
- NFR coverage: 5/5 (100%) – retention/compliance targets added
- Epics mapped: 5/5 (100%)
- Stories readiness (est.): 88% – per‑epic tech‑spec drafts present; refine in Phase 4
- Readiness score: 95%

## FR Coverage Map

| FR | Summary (from PRD) | Resolution (Component/Contract/API) |
| -- | ------------------- | ----------------------------------- |
| FR001 | 33ms 增量 | aggregator-go → xy.md.tick.{group}；UI SharedWorker 批处理 |
| FR002 | 2–5s 快照 | aggregator-go → xy.md.snapshot.{group}；断点重建逻辑 |
| FR003 | 单条 WebSocket + TLS/JWT/NKey | ws-gateway + NATS Accounts/JWT；SharedWorker 扇出 |
| FR004 | SharedWorker 扇出/COOP/COEP | UI SharedWorker + COOP/COEP 自检脚手架 |
| FR005 | 订阅/筛选/Top‑K ≤500ms | UI FilterPanel + aggregator 限流/分片；NATS RPC 控制面 |
| FR006 | 多窗口布局/状态 | UI 布局保存，SharedWorker 缓存统一 |
| FR007 | Worker 解码 + OffscreenCanvas | UI 解码器 + OffscreenCanvas 增量绘制；帧预算≤8ms |
| FR008 | at‑most‑once/丢帧策略 | UI 优先级/阈值配置 + 网关限流；事件幂等 |
| FR009 | 账户/风险 1–2s 告警 | OptionMaster 指标 → xy.risk.metrics.{accountId} |
| FR010 | 请求‑应答幂等/超时 | xy.exec.*（corr_id/idempotency）；重试/退避策略 |
| FR011 | 契约与代码生成 | packages/contracts（Protobuf + buf）TS/Go/Py 生成 |
| FR012 | Subject ACL 最小权限 | NATS accounts/permissions 清单；按上下文前缀授权 |
| FR013 | 端到端可观测 | Prometheus 指标：延迟/FPS/带宽/慢消费者；日志追踪 |
| FR014 | 三级降级 | 采样降频→字段裁剪→面板停更；恢复条件定义 |
| FR015 | 会话恢复≤3s/版本单调 | UI 恢复 + 版本校验；快照重建失败进入只读并告警 |
| FR016 | TypedArray 环形缓冲/回压 | Worker 环形缓冲；回压信号/上限保护 |
| FR017 | ROI/Top‑K 热更新灰度 | aggregator 参数热更；NATS 控制面 |
| FR018 | JetStream 审计/回放 | 流保存审计；回放基准测试路径 |
| FR019 | dev/prod 隔离/特性开关 | 环境配置/特性开关；CI/CD 管道 |
| FR020 | 权限化 UI | 主题前缀 + 前端路由守卫（RBAC 简化版） |
| FR021 | 订阅/事件节流 | SharedWorker/网关双侧节流；最小间隔策略 |
| FR022 | 运行时兼容守护 | 未知字段容忍+打点；破坏性变更保护模式 |

## NFR Coverage (Key)

- NFR001 性能/时延：满足（验收：rAF p95 ≤16.7ms/p99 ≤25ms；工程预算≤8ms；端到端 P95 < 120ms 设计）
- NFR00X 可用性/恢复：满足（RTO ≤ 10 分钟；RPO ≤ 5 分钟；探针/滚更/回滚策略）
- NFR00X 安全：满足（JWT/NKey、TLS、最小权限）
- NFR00X 可观测：满足（Prometheus 指标/日志/追踪）
- NFR00X 合规/留存：满足（JetStream 留存与审计导出流程量化；DB 备份与演练）

## Detected Vagueness / Over‑spec

- Vagueness：无（ACL 样例表已提供；其余细节移交运维手册）。
- Over‑spec：无（文档保持设计层级，无 >10 行实现代码）。

## Actions to reach ≥95%

- 补充 per‑epic 技术规格（Step 9）。
