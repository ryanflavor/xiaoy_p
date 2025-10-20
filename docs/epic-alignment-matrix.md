# Epic Alignment Matrix

| Epic | Components | Data Models | APIs/Subjects | External |
| ---- | ---------- | ----------- | ------------- | -------- |
| 1 基础设施与单连接骨架 | Platform / UI / MarketData | contracts, sessions | xy.exec.algo.*, xy.md.*, ws 单连接 | NATS/JetStream |
| 2 虚拟账户监控 | AccountsRisk / UI | positions, risk_metrics | xy.risk.metrics.{accountId} | Prometheus |
| 3 手选T型报价 | MarketData / UI | quotes_read_model | xy.md.tick/snapshot, xy.exec.order.* | — |
| 4 自动生成与自动解析 | StrategySuggestion / UI | portfolio_candidates | suggestion.*（NATS RPC） | — |
| 5 策略下单与执行 | AlgoExecution / UI | orders, order_events | xy.exec.order.*, xy.exec.events.* | vn.py 网关 |

