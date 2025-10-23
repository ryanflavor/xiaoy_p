# Step 5 — Next Epic Preparation

Readiness Dimensions
- Dependencies: Epic 2 对 Epic 1 的关键依赖（1.2 / 1.5 / 1.6）已满足。
- Setup: 需要补齐 1.7 的评审项以避免监控盲区（非硬阻塞）。
- Knowledge Gaps: 需要明确 risk.metrics 数据源与 JSON/文本解析策略；鉴权/ACL 规则细化。
- Infra: 建议为 xy.risk.metrics.* 增设 JSON 端点或 Prometheus 文本解析器；UI 订阅层契约定义。

Definition of Ready — Epic 2
1) xy.risk.metrics 合同/Schema 定义完成（positions/risk_metrics）
2) 虚拟网关清单与状态源对齐（2.1）
3) UI 读模型与表格虚拟化骨架复用 1.6 能力
4) 观测项接入：risk_push_rate / risk_latency / calc_errors 暴露并可视
