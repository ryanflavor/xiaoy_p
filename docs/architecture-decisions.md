# Architecture Decision Records

**Project:** xiaoy
**Date:** 2025-10-20
**Author:** ryan

---

## Overview

This document captures all architectural decisions made during the solution architecture process. Each decision includes the context, options considered, chosen solution, and rationale.

---

## Decision Format

Each decision follows this structure:

### ADR-NNN: [Decision Title]

**Date:** YYYY-MM-DD
**Status:** [Proposed | Accepted | Rejected | Superseded]
**Decider:** [User | Agent | Collaborative]

**Context:**
What is the issue we're trying to solve?

**Options Considered:**

1. Option A - [brief description]
   - Pros: ...
   - Cons: ...
2. Option B - [brief description]
   - Pros: ...
   - Cons: ...
3. Option C - [brief description]
   - Pros: ...
   - Cons: ...

**Decision:**
We chose [Option X]

**Rationale:**
Why we chose this option over others.

**Consequences:**

- Positive: ...
- Negative: ...
- Neutral: ...

**Rejected Options:**

- Option A rejected because: ...
- Option B rejected because: ...

---

## Decisions


### ADR-001: 统一消息总线迁移到 NATS/JetStream
Status: Accepted

- Context: 现存 ZMQ/RabbitMQ 难以统一治理与审计
- Decision: 统一采用 NATS（RPC + 流式），JetStream 做审计/回放
- Consequences: 需要契约先行、主题 ACL；客户端迁移成本

### ADR-002: 前端单连接 + SharedWorker
Status: Accepted

- Context: 多窗口并开与高频 UI 更新
- Decision: 单条 WS 连接，SharedWorker 扇出，多标签共享订阅与缓存
- Consequences: 需要批处理/去重策略与降级

### ADR-003: DDD 模块化单体 + 专用聚合器服务
Status: Accepted

- Context: 团队规模与演进速度
- Decision: 单体按上下文分层，聚合器独立服务（Go）
- Consequences: 依赖与包边界严格；后续可按上下文拆分服务

### ADR-004: 契约治理采用 Protobuf + buf（append-only）
Status: Accepted

- Context: 多语言多服务一致性
- Decision: 以 contracts 仓库为唯一真相，CI 做兼容检查
- Consequences: 变更流程更严格，先契约后实现

### ADR-005: 数据存储统一 PostgreSQL + JetStream
Status: Accepted

- Context: 历史沿用多 DB；审计需要流式存储
- Decision: 业务持久化用 Postgres，审计/回放走 JetStream
- Consequences: 读模型/审计分离；迁移期双写/同步


---

## Decision Index

| ID  | Title | Status | Date | Decider |
| --- | ----- | ------ | ---- | ------- |


| 001 | 统一消息总线迁移到 NATS/JetStream | Accepted | | Collaborative |
| 002 | 前端单连接 + SharedWorker | Accepted | | Collaborative |
| 003 | DDD 模块化单体 + 专用聚合器 | Accepted | | Collaborative |
| 004 | 契约治理 Protobuf + buf | Accepted | | Collaborative |
| 005 | 数据存储统一 PostgreSQL + JetStream | Accepted | | Collaborative |


---

_This document is generated and updated during the solution-architecture workflow_
