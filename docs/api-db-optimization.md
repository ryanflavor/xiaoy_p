# API and Database Optimization Plan (Deep Dive)

Scope
- Target modules: `algo_trading`, `portfolio_generator`, `option_master` (legacy under vnpy/app/*).
- Goal: Keep trading API in Python/vn.py; replace UI and RPC with Web + NATS; redesign stable, auditable APIs and Postgres schema to support high‑throughput, low‑latency workflows.

---

## 1) Algo Trading (AlgoExecution context)

Responsibilities
- Manage algorithm lifecycle and parameterization; place/cancel orders; handle comb actions; emit order/trade events and health.

NATS Subjects (request–reply unless noted)
- `exec.algo.start` → `exec.algo.ack`
- `exec.algo.stop` → `exec.algo.ack`
- `exec.algo.resume` → `exec.algo.ack`
- `exec.order.place` → `exec.order.result` (corr_id)
- `exec.order.cancel` → `exec.order.ack`
- `exec.comb.action` → `exec.comb.ack`
- Streams (JetStream, publish only):
  - `exec.events.order.*` (accepted/rejected/filled/partially_filled/canceled)
  - `exec.events.trade.*`
  - `exec.health` (periodic)

Payloads (Protobuf intent – to be added in `packages/contracts`)
- `AlgoStart { algo_name, portfolio_id, gateway_name, params (map<string,string>), corr_id }`
- `AlgoAck { corr_id, ok, error }`
- `OrderIntent { vt_symbol, direction, price, volume, order_type, offset, lock, corr_id }`
- `OrderResult { corr_id, vt_orderid, status, reason }`
- `CombAction { comb_vt_symbol, volume, comb_action, group_type, direction, corr_id }`
- `OrderEvent { vt_orderid, event, ts, details_json }`
- `TradeEvent { vt_orderid, trade_id, price, volume, ts }`

Database (PostgreSQL 16.6)
- `orders`
  - `id` PK, `corr_id` UNIQUE, `vt_orderid` UNIQUE, `vt_symbol`, `side`, `price`, `qty`, `type`, `offset`, `lock`, `gateway`, `status`, `created_at`, `updated_at`
  - Index: `(gateway, vt_orderid)`, `(created_at)`
- `order_events`
  - `id` PK, `vt_orderid` FK orders, `event`, `payload_json`, `ts`
  - Index: `(vt_orderid, ts)`
- `algo_runs`
  - `id` PK, `algo_name`, `portfolio_id`, `gateway`, `params_json`, `status`, `started_at`, `ended_at`
- `algo_params`
  - `id` PK, `algo_name`, `version`, `schema_json`, `created_at`

Notes
- Keep execution critical path in memory (vn.py). DB is for audit/reporting; events are persisted via JetStream, then ETL to DB if needed.
- All request–reply use `corr_id` for tracking. UI subscribes to `exec.events.*` for live status.

---

## 2) Portfolio Generator (StrategySuggestion context)

Responsibilities
- Generate candidate option portfolios (manual/auto/delta/margin/open/close) with leg maps; validate against risk rules; return top‑K.

NATS Subjects
- `suggestion.generate` → `suggestion.result` (list of candidates)
- `suggestion.validate` → `suggestion.validation`
- `suggestion.select` → `suggestion.ack` (persist selection for execution)

Payloads
- `GenerateRequest { template, parameters (map<string,string>), gateway, universe[] }`
- `Candidate { candidate_id, legs[ {vt_symbol, leg_id, side, weight} ], metrics_json }`
- `GenerateResult { corr_id, candidates[] }`
- `Selection { candidate_id, overrides_json, corr_id }`

Database
- `portfolio_candidates`
  - `id` PK, `template`, `params_json`, `legs_json`, `metrics_json`, `score`, `created_at`
  - Index: `(template, created_at)`
- `portfolio_selections`
  - `id` PK, `candidate_id` FK, `overrides_json`, `selected_by`, `selected_at`

Notes
- Generator does not write trading orders; it proposes candidates. Chosen candidate yields one or many `OrderIntent` to `exec.order.place`.

---

## 3) Option Master (MarketData/AccountsRisk support)

Responsibilities
- Maintain option portfolios, compute greeks and PnL, subscribe to ticks/underlyings, expose read‑models for UI/risk.

NATS Subjects
- `risk.metrics.get` → `risk.metrics.result` (current snapshot)
- Streams:
  - `md.tick.*`, `md.snapshot.*` (produced by Aggregator‑Go)
  - `risk.metrics.*` (periodic account/risk snapshots for UI)

Database
- `risk_metrics`
  - `id` PK, `account_id`, `window`, `metrics_json`, `ts`
  - Index: `(account_id, ts DESC)`
- `positions`
  - `id` PK, `account_id`, `vt_symbol`, `qty`, `avg_price`, `pnl`, `greeks_json`, `updated_at`

Notes
- OptionMaster retains JSON settings on disk for local tuning; canonical snapshots go to NATS + Postgres.

---

## 4) Cross‑module DB model (DDL excerpt)

```sql
-- orders
create table if not exists orders (
  id bigserial primary key,
  corr_id text unique not null,
  vt_orderid text unique,
  vt_symbol text not null,
  side text not null,
  price numeric(18,6) not null,
  qty numeric(18,6) not null,
  type text not null,
  offset text,
  lock text,
  gateway text not null,
  status text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_orders_gateway_order on orders(gateway, vt_orderid);

-- order_events
create table if not exists order_events (
  id bigserial primary key,
  vt_orderid text not null references orders(vt_orderid),
  event text not null,
  payload_json jsonb not null,
  ts timestamptz default now()
);
create index if not exists idx_order_events_time on order_events(vt_orderid, ts);

-- algo_runs
create table if not exists algo_runs (
  id bigserial primary key,
  algo_name text not null,
  portfolio_id text,
  gateway text,
  params_json jsonb not null,
  status text not null,
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- portfolio_candidates
create table if not exists portfolio_candidates (
  id bigserial primary key,
  template text not null,
  params_json jsonb not null,
  legs_json jsonb not null,
  metrics_json jsonb,
  score numeric(18,6),
  created_at timestamptz default now()
);
create index if not exists idx_candidates_tpl_time on portfolio_candidates(template, created_at);

-- portfolio_selections
create table if not exists portfolio_selections (
  id bigserial primary key,
  candidate_id bigint not null references portfolio_candidates(id),
  overrides_json jsonb,
  selected_by text,
  selected_at timestamptz default now()
);

-- positions
create table if not exists positions (
  id bigserial primary key,
  account_id text not null,
  vt_symbol text not null,
  qty numeric(18,6) not null,
  avg_price numeric(18,6),
  pnl numeric(18,6),
  greeks_json jsonb,
  updated_at timestamptz default now()
);
create index if not exists idx_positions_account on positions(account_id, vt_symbol);

-- risk_metrics
create table if not exists risk_metrics (
  id bigserial primary key,
  account_id text not null,
  window text not null,
  metrics_json jsonb not null,
  ts timestamptz default now()
);
create index if not exists idx_risk_metrics_time on risk_metrics(account_id, ts desc);
```

---

## 5) Mapping from legacy code

- Replace `vnpy.rpc` (ZeroMQ) calls in algo/center/client with NATS subjects above. Keep vn.py engines and order routes intact behind a NATS adapter.
- Replace UI‑bound PyQt widgets in portfolio_generator/option_master with read‑model APIs over NATS + periodic JetStream snapshots.
- Preserve domain logic (pricing/greeks, leg maps, order price calculation) while externalizing IO.

---

## 6) Observability and governance

- Every request–reply logs `corr_id` and publishes an `order_events` entry; Prometheus metrics for latency, success ratio, slow consumers.
- ADRs updated: ADR‑001..005 already captured in `docs/architecture-decisions.md`.

---

## 7) Next steps

- Contracts: add `.proto` definitions for payloads above in `packages/contracts` and generate TS/Go/Py types via `buf`.
- Migrations: create Alembic revision with DDL; wire services to use `psycopg` 3 + SQLAlchemy 2 session patterns.
- Service scaffolds: `services/algo-exec-py`, `services/ws-gateway`, `services/aggregator-go` to implement the NATS interfaces.

