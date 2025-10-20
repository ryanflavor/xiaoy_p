# Technical Specification: 手选T型报价与核心可视（Manual T-Shape Quotes）

Date: 2025-10-20
Author: ryan
Epic ID: 3
Status: Draft

---

## Overview

实现手选 T 型报价与核心可视，支持候选组合选择与指标叠加。

## Objectives and Scope

- In: quotes_read_model, 手选面板；- Out: 自动生成与执行

## System Architecture Alignment

上下文：MarketData/UI；主题：xy.md.tick/snapshot；组件：DataGrid/Chart

## Detailed Design

### Services and Modules

- 前端 panels：T-Shape Quotes、MetricsOverlay；SharedWorker 聚合/去重。

### Data Models and Contracts

- quotes_read_model 内存模型（前端）；必要汇总落地仅用于回放分析。

### APIs and Interfaces

- 订阅控制：xy.ui.subscriptions.set（可选）
- 流：xy.md.tick.*, xy.md.snapshot.*

### Workflows and Sequencing

- 用户筛选/订阅→SharedWorker→渲染

## Non-Functional Requirements

### Performance

- rAF 帧 p95 ≤ 16.7ms；面板更新可见 ≤ 500ms

### Security

- UI 权限化：隐藏敏感操作

### Reliability/Availability

- 慢消费者保护：合并/丢帧策略

### Observability

- fps, end2end_latency, bandwidth, slow_consumers

## Dependencies and Integrations

React/TanStack Table/OffscreenCanvas

## Acceptance Criteria (Authoritative)

1) 面板稳定 60 FPS；2) 变更 ≤ 500ms 可见；3) 丢帧策略在负载高时生效；4) 指标可见。

## Traceability Mapping

| 1 | 性能 | UI | WS+渲染 | fps-test |

## Risks, Assumptions, Open Questions

- Risk: 表格渲染瓶颈 → 虚拟化与批量绘制
- Question: 初期是否需要服务端聚合更多字段？

## Test Strategy Summary

- 单元：渲染组件；E2E：多窗口操作；性能：FPS 采样。
