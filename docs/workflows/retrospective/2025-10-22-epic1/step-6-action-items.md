# Step 6 — Action Items

Process Improvements
1. 在 PR 合并前运行“Epic 出口检查”脚本（README 更新 + 回归清单） — Owner: SM — By: 2025-10-23
2. 在 docs 增补“指标字段字典”生成脚本（与 1.5/1.7 一致） — Owner: DEV — By: 2025-10-24

Technical Debt (carryover from 1.7)
1. 接入“重连/订阅风暴计数”真实指标到 Grafana/Demo — Owner: DEV — Priority: High
2. 阈值越界→降级控制实际接线与恢复判定用例 — Owner: DEV — Priority: High
3. 分组维度与 Top‑N 基于真实 subject/标签落地 — Owner: DEV — Priority: Medium

Next Epic Preparation
1. 定义风险指标合同（xy.risk.metrics.* Schema + 示例） — Owner: Architect — By: 2025-10-23
2. 虚拟网关 ACL/状态接口草稿与样例数据 — Owner: Architect — By: 2025-10-23
3. UI 读模型/表格骨架从 1.6 抽取复用（组件/性能基线） — Owner: DEV — By: 2025-10-24
4. 观测接入：risk_push_rate / risk_latency / calc_errors 暴露与可视化 — Owner: DEV — By: 2025-10-24
