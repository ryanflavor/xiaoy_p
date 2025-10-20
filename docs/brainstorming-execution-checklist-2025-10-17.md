# Brainstorming Execution Checklist (PoC, 2 Weeks)

Date: 2025-10-17
Scope: Web frontend for high-frequency market data; backend NATS JetStream + vn.py; distributed microservices; replace PyQt5 and ZMQ.

## Contracts & Subjects
- [ ] Define schema registry and codegen (TS/Python)
  - [ ] Snapshot: Protobuf (every 2–5s)
  - [ ] Delta: FlatBuffers (33ms; ROI-only fields)
- [ ] Subject naming & ACL
  - [ ] `md.raw.<ex>.<sym>` (internal)
  - [ ] `md.agg.33ms.<group>` (FBS delta)
  - [ ] `md.snapshot.<group>` (Proto snapshot)
  - [ ] `acct.status.1s.<trader>` / `acct.risk.1s.<trader>`
  - [ ] `order.req.<trader>.<strategy>` (NATS request-reply)
  - [ ] Map JWT/NKey → subject ACL (least privilege)

## Aggregator (33→50ms self-adaptive)
- [ ] Ingest from vn.py adapters via NATS `md.raw.*`
- [ ] Group membership update API (`group.update`) with 250–500ms debounce
- [ ] ROI field selection + Top‑K bound per batch (rows/bytes/ms budgets)
- [ ] Emit `md.agg.33ms.<group>` (FBS) + periodic Proto snapshots
- [ ] Metrics: qps, bytes/s, batch size, p95/p99, drop rate
- [ ] Sharding & HPA policy; graceful degradation on overload

## NATS / WS Gateway
- [ ] Single WS connection per user; slow-consumer handling visible
- [ ] Compression policy: snapshots only; deltas uncompressed or thresholded
- [ ] Backpressure signals + write buffer sizing
- [ ] Reconnect & session re-subscribe with exponential backoff

## Frontend Connection & Decode
- [ ] SharedWorker: 1 WS connection per user
- [ ] BroadcastChannel fanout to tabs
- [ ] Worker decode FBS → SoA TypedArray ring buffer (fixed capacity)
- [ ] Optional: COOP/COEP for SharedArrayBuffer (phase 2)

## Rendering & UI
- [ ] OffscreenCanvas/Canvas list renderer (avoid DOM thrash)
- [ ] rAF-aligned incremental painting (batch by viewport/tiles)
- [ ] Detail panes subscribe `md.tick.<ex>.<sym>` on demand
- [ ] Reduce text layout; bitmap/atlas for heavy columns

## Commands & Aux Channels
- [ ] Orders via NATS request-reply (idempotent id, timeout/retry)
- [ ] `acct.status` / `acct.risk` 1–2s cadence (separate from 33ms stream)
- [ ] Risk events `risk.event` (threshold/fuse/slippage anomalies)

## JetStream (Backoffice/Replay only)
- [ ] Separate streams/consumers; retention by trading day/hour
- [ ] Rate-limited replay; UI real-time path disabled by default

## Observability & SLOs
- [ ] In‑tab dashboard: FPS, rAF frame time p95/p99, CPU main/total, e2e latency, batch bytes/rows, drop rate
- [ ] Alerts: >50ms long tasks, p99 frame >25ms, batch overflow, WS slow-consumer
- [ ] Log correlation ids across adapter→agg→WS→UI

## Validation (PoC)
- [ ] Scenario: 100 visible rows; 4–5 windows; 10 traders; 2k avg / 4k peak tick/s
- [ ] Targets: 60 FPS; e2e p95 < 120ms, p99 < 180ms
- [ ] CPU: main < 30%, total < 50%; GC major < 1/min
- [ ] Network: ≤ 2 Mbps per active group; one WS per user

## Deliverables
- [ ] Running aggregator, WS gateway, schema/codegen, data simulator
- [ ] Frontend demo (list + account/risk + simple params)
- [ ] Metrics dashboard & report

