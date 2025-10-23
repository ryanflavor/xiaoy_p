---
title: /metrics.json 统一格式评估（草案）
date: 2025-10-22
---

目标
- 统一前端/仪表盘与后端网关的指标接口，减少解析 Prometheus 文本的复杂度与歧义。

端点
- GET /metrics.json （application/json; charset=utf-8）

字段（最小集合）
- latency_p50, latency_p95, latency_p99: number(ms)
- slow_consumers: number
- ws_active: number
- ws_msgs_rate: number(msgs/s)
- xy_nats_reconnects_total: number(counter)
- xy_sub_storms_total: number(counter)
- latency_p95_by_group: Record<string, number>
- slow_consumers_by_group: Record<string, number>
- timestamp: number(epoch ms)

兼容建议
- 若 Prometheus 文本为主，可在网关内做一次性转换并缓存 N 秒（例如 1–2s），导出上述 JSON。
- 命名映射表维持在服务端，前端仅消费统一字段名，避免多端分歧。

安全
- 仅在受限网段或经鉴权的管理平面暴露；生产环境收紧 CORS。

后续
- 可扩展字段：bandwidth、error_budget_burn_5m/1h 等派生指标（由服务端或前端计算）。

