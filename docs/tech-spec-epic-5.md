# Technical Specification: 策略下单与算法执行集成（Algo Ordering & Execution）

Date: 2025-10-20
Author: ryan
Epic ID: 5
Status: Draft

---

## Overview

以 vn.py 执行下单与回执，支持算法生命周期、组合指令与幂等控制。

## Objectives and Scope

- In: 订单/算法指令；- Out: 回执与事件流

## System Architecture Alignment

上下文：AlgoExecution；主题：xy.exec.order.*、xy.exec.algo.*、xy.exec.events.*

## Detailed Design

### Services and Modules

- algo-exec-py（vn.py + nats-py + FastAPI）

### Data Models and Contracts

- orders, order_events；corr_id/idempotency 字段

### APIs and Interfaces

- xy.exec.order.place/cancel；xy.exec.algo.start|stop|resume；xy.exec.comb.action；events 流

### Workflows and Sequencing

- OrderIntent（含 corr_id）→ 执行 → OrderResult + 事件流

## Non-Functional Requirements

### Performance

- 下单请求→回执 P95 < 150ms（同机房）

### Security

- 每账户主题前缀与 JWT 声明绑定；签名/重放防护

### Reliability/Availability

- 自动重试与去重；断点续传

### Observability

- 指标：exec_req_latency、order_events/sec、errors

## Dependencies and Integrations

vn.py、nats-py、prometheus-client、psycopg

## Acceptance Criteria (Authoritative)

1) 幂等：相同 corr_id 不重复下单；2) 回执包含 vt_orderid；3) 事件流完整且可回放；4) 安全策略生效。

## Traceability Mapping

| 1 | 安全/幂等 | algo-exec | xy.exec.* | rpc+replay |

## Risks, Assumptions, Open Questions

- Risk: 网关拥塞 → 排队与限流
- Question: 是否需要多路由冗余？

## Test Strategy Summary

- 单元：幂等存储；集成：NATS RPC；E2E：下单链路。
