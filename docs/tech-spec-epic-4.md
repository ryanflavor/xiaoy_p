# Technical Specification: 自动生成与自动解析（Auto Generator & Auto Parsing）

Date: 2025-10-20
Author: ryan
Epic ID: 4
Status: Draft

---

## Overview

自动生成与自动解析组合候选，提供评分与校验，输出候选列表供执行环节选择。

## Objectives and Scope

- In: 生成/校验；- Out: 下单执行

## System Architecture Alignment

上下文：StrategySuggestion；主题：suggestion.*（RPC）

## Detailed Design

### Services and Modules

- generator-core（Py）：策略模板、参数校验、评分；
- ai/解析器（可选）

### Data Models and Contracts

- portfolio_candidates(id, template, params_json, legs_json, metrics_json, score)

### APIs and Interfaces

- suggestion.generate → suggestion.result；suggestion.validate → suggestion.validation；suggestion.select → suggestion.ack

### Workflows and Sequencing

- 请求生成 → 候选集 → 选择/覆盖 → 提交执行

## Non-Functional Requirements

### Performance

- 生成耗时 < 2s（典型）；批量不阻塞 UI

### Security

- 仅授权用户可生成/选择

### Reliability/Availability

- 失败回退默认候选

### Observability

- counters：gen_requests、candidates_count、validation_failures

## Dependencies and Integrations

pandas/polars、FastAPI

## Acceptance Criteria (Authoritative)

1) 生成至少 N 个候选；2) 校验失败给出原因；3) 选择后能导出 OrderIntent。

## Traceability Mapping

| 1 | 设计 | generator | suggestion.* | unit+rpc |

## Risks, Assumptions, Open Questions

- Risk: 参数空间爆炸 → 约束与缓存
- Assumption: 指标权重可配置

## Test Strategy Summary

- 单元：评分函数；集成：RPC；E2E：用户选择路径。
