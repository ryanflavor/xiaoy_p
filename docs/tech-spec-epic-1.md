# Technical Specification: 基础设施与单连接骨架（Foundation & Single-Connection）

Date: 2025-10-20
Author: ryan
Epic ID: 1
Status: Draft

---

## Overview

为 Web + NATS 架构奠定基础：建立单连接 WS 网关、SharedWorker 扇出、Aggregator-Go 的 33ms 增量/2–5s 快照通道，完成契约治理与观测基线。

## Objectives and Scope

- In: ws-gateway、SharedWorker、aggregator-go、contracts/buf、观测/安全基线
- Out: 业务面板与策略执行细节

## System Architecture Alignment

组件：services/ws-gateway、services/aggregator-go、packages/contracts；约束：单连接、一致性、append-only 契约、JetStream 审计。

## Detailed Design

### Services and Modules

- ws-gateway（Node）：WS→NATS 转发，JWT 校验；
- aggregator-go（Go）：tick/snapshot 生产与分片；
- contracts：Protobuf + buf（TS/Go/Py 生成）。

### Data Models and Contracts

- contracts：md.tick、md.snapshot、session、feature_flags；
- sessions 表（可选，仅记录登录/健康）。

### APIs and Interfaces

- xy.md.tick.{group}（JS 流）；xy.md.snapshot.{group}
- xy.exec.health（健康流）
- 管理 HTTP：/healthz, /metrics, /admin/feature-flags

### Workflows and Sequencing

- Aggregator 订阅源→生成 tick/snapshot→NATS 流→ws-gateway→SharedWorker 扇出

## Non-Functional Requirements

### Performance

- WS 单连接稳定；P95 首字节 < 100ms；快照重建 ≤ 1s；帧预算 ≤ 8ms

### Security

- NATS Accounts + JWT/NKey；主题 ACL 前缀 xy.*；TLS 强制

### Reliability/Availability

- 慢消费者保护；网关灰度发布；JetStream 保留策略

### Observability

- 指标：ws_active, ws_msgs, nats_req_latency, ticks_out, snapshots_out

## Dependencies and Integrations

Node 22、Go 1.25、NATS 2.12、buf、protoc、Prometheus

## Acceptance Criteria (Authoritative)

1) 单连接与 SharedWorker 扇出稳定（无重复连接）；
2) tick 33ms/快照 2–5s 达标；
3) 所有主题受 ACL 管控；
4) 指标/日志齐备；
5) 契约变更经 buf 兼容检查通过。

## Traceability Mapping

| AC | Spec | Components | APIs | Test |
| -- | -- | -- | -- | -- |
| 1 | 4/WS 网关 | ws-gateway | xy.md.*, WS | e2e-conn |
| 2 | 4/聚合器 | aggregator-go | xy.md.* | perf-sim |
| 3 | 5/安全 | contracts+gateway | NATS ACL | sec-test |
| 4 | 5/观测 | all | /metrics | prom-scrape |
| 5 | 3/契约 | contracts | buf check | ci-job |

## Risks, Assumptions, Open Questions

- Risk: 网关拥塞 → 限流+优先级
- Assumption: 上游行情源稳定
- Question: 是否需要多地域冗余？

## Test Strategy Summary

- 单元：网关适配、契约生成；集成：NATS RPC/流；E2E：多窗口订阅与恢复；性能：tick 注入与 UI FPS 监测。
