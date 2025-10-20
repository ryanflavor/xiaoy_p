# Technical Specification: 虚拟账户监控（Virtual Account Monitor）

Date: 2025-10-20
Author: ryan
Epic ID: 2
Status: Draft

---

## Overview

为账户/风险视图提供 1–2s 节奏指标，形成 positions 与 risk_metrics 读模型并周期推送。

## Objectives and Scope

- In: 指标计算、读模型与推送；- Out: 下单/策略逻辑

## System Architecture Alignment

上下文：AccountsRisk；数据：positions、risk_metrics；主题：xy.risk.metrics.{accountId}

## Detailed Design

### Services and Modules

- option-master（Py/vn.py）读取持仓与行情，计算 Greeks/PnL；定期快照。

### Data Models and Contracts

- positions(id, account_id, vt_symbol, qty, avg_price, pnl, greeks_json)；
- risk_metrics(id, account_id, window, metrics_json, ts)

### APIs and Interfaces

- xy.risk.metrics.{accountId}（流）
- 管理 HTTP：/healthz, /metrics

### Workflows and Sequencing

- vn.py → 聚合指标 → 推送 xy.risk.metrics.* → UI 订阅渲染

## Non-Functional Requirements

### Performance

- 快照 1–2s；处理时延 < 200ms

### Security

- 仅账户 owner 可订阅其 risk.metrics

### Reliability/Availability

- 指标计算异常回退上次有效值

### Observability

- 指标：risk_push_rate, risk_latency, calc_errors

## Dependencies and Integrations

vn.py、pandas/polars、prometheus-client

## Acceptance Criteria (Authoritative)

1) 每 1–2s 推送指标；2) 指标正确性校验（校对样本）；3) 订阅鉴权；4) 异常回退与告警。

## Traceability Mapping

| AC | Spec | Components | APIs | Test |
| -- | -- | -- | -- | -- |
| 1 | NFR 性能 | option-master | xy.risk.metrics.* | rate-test |
| 2 | 数据模型 | positions/risk_metrics | — | unit-calc |

## Risks, Assumptions, Open Questions

- Risk: 计算瓶颈 → 向量化+批处理
- Assumption: 行情足够完整

## Test Strategy Summary

- 单元：指标函数；集成：订阅鉴权；E2E：UI 呈现与告警。
