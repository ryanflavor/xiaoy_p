# Market Data Sources and Ingestion

目的：明确行情源对接方式与标准化发布路径，支撑 Aggregator‑Go 的稳定输入。

## 1. Upstream 选项（示例）
- 交易所链路：CTP/CTP Mini（期货/期权）、SSE/SZSE 证券接口、XTP、OES、ETF 期权 SOPT 等（按合规获取）。
- 券商/直连：按资质接入，同样通过 vn.py 网关适配。
- 回放/模拟：JetStream 历史流回放（xy.src-replay.*）。

## 2. 适配层（services/src-adapter-vnpy）
- 从 vn.py gateway 订阅 Tick/合约事件 → 标准化 → 发布到：
  - `xy.src.tick.{venue}.{symbol}`（原始 Tick）
  - `xy.ref.contract.{venue}.{symbol}`（合约/元数据）
  - `xy.src.heartbeat.{venue}`（心跳）
- 限速/重试：每主题频率保护与网络抖动重试；失败计数指标。
- 安全：只写 `xy.src.*` 与 `xy.ref.*`；凭据与 ACL 通过 NATS Accounts 管理。

## 3. 契约与字段（建议 Protobuf）
- Tick：ts_exchange、ts_arrival、bid/ask 阶梯、last、volume、open_interest、trading_status、seq、source、flags。
- Contract：symbol、exchange、instrument_type、multiplier、pricetick、lot_size、trading_hours、listing/expiry、underlying。

## 4. 质量与观测
- 指标：src_ingest_rate、src_gap、reorder_count、invalid_ticks、heartbeat_age。
- 告警：心跳超时、缺口连续 N 次、重复率超标、乱序窗口超限。

## 5. 回放与基准
- 按交易日/主题进行 JetStream 分区保留；工具支持时间窗口回放与倍率控制。

_本文件与 docs/solution-architecture.md“2.5 Market Data Ingestion”一致，作为实现参考。_

