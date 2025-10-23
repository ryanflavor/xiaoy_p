---
title: 观测字段字典（Story 1.7）
date: 2025-10-22
---

本文件汇总 Story 1.7 涉及的指标名称、单位与来源，确保命名与单位一致。

指标命名遵循：小写下划线，Prometheus 语义；UI 端保持同义映射。

服务端（ws-gateway）：
- ws_active — 活动 WebSocket 连接数（gauge）
- ws_msgs_rate — 转发消息速率 msgs/s（gauge，抓取时计算）
- slow_consumers — 慢消费者事件计数（counter）
- xy_ws_messages_forwarded_total — 已转发消息总数（counter）
- xy_ws_messages_dropped_total{reason} — 丢弃计数（counter，含原因标签）
- xy_ws_send_queue_size — 连接队列最大长度（gauge）
- xy_nats_reconnects_total — NATS 重连次数（counter）
- xy_sub_storms_total — 订阅风暴计数（counter）

聚合器（aggregator-go）：
- ticks_out — 输出的 tick 数（counter）
- snapshots_out — 输出的快照数（counter）
- nats_req_latency_bucket — NATS 请求延迟直方图桶（histogram，ms）
  - 导出分位：p50/p95/p99 = histogram_quantile(0.50/0.95/0.99, sum by (le) rate(...[5m]))

前端（apps/ui）：
- ui_fps — 帧率（gauge，fpsMeter 计算）
- ui_e2e_latency_ms — 端到端延迟（latency，统计 p50/p95/p99，单位 ms）
- ui_slow_consumers — 慢消费者事件（counter，UI 侧感知）
- ui_degrade_events — 降级事件计数（counter）
- bandwidth — 近似带宽（KB/s，渲染层估算）

SLO/阈值（slo-config.mjs）：
- 延迟：p95≤120ms；p99≤180ms
- 帧率：warn<30fps，crit<20fps
- 慢消费者：warn≥1，crit≥3
- 错误预算：目标可用性 99.9%，窗口 5m/1h（预算分别为 300ms / 3.6s）

对齐参考：docs/PRD.md（FR013–FR015，NFR001/NFR004），docs/solution-architecture.md。
