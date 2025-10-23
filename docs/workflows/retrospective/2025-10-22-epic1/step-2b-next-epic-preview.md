# Step 2b — Preview Next Epic

Next epic: Epic 2 — 虚拟账户监控（Virtual Account Monitor）

Dependencies & Prereqs from epics.md / tech-spec-epic-2.md
- 2.1 depends on 1.2（网关最小链路） — satisfied
- 2.2 depends on 2.1 + 1.6（UI 最小面板） — 1.6 satisfied
- 2.5 depends on 2.2 + 1.5（观测） — 1.5 satisfied

Noted New Capabilities
- 风险/账户读模型与周期推送（1–2s）
- 订阅鉴权与 ACL 最小权限
- 指标（risk_push_rate, risk_latency, calc_errors）
