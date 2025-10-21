import test from 'node:test'
import assert from 'node:assert/strict'
import { MetricsRegistry, MetricNames } from '../src/lib/metrics/metrics.mjs'
import { decodeTick } from '../../../packages/ts-contracts/src/index.js'

test('old producer → new consumer (missing optional new fields tolerated)', () => {
  // v1 producer sends minimal fields
  const v1 = { ts_ms: 111, symbol: 'ESZ5', price: 5000.25 }
  // new consumer accepts, no unknowns
  const reg = new MetricsRegistry()
  const unk = reg.counter(MetricNames.ui_unknown_fields)
  const t = decodeTick(v1, { onUnknownField: () => unk.inc() })
  assert.equal(t.symbol, 'ESZ5')
  assert.equal(unk.value, 0)
})

test('new producer → old consumer (extra fields tolerated and counted)', () => {
  // v2 producer adds fields (append-only)
  const v2 = { ts_ms: 222, symbol: 'ESZ5', price: 5001.00, trade_id: 't1', micro: 123 }
  const reg = new MetricsRegistry()
  const unk = reg.counter(MetricNames.ui_unknown_fields)
  const t = decodeTick(v2, { onUnknownField: () => unk.inc() })
  assert.equal(t.symbol, 'ESZ5')
  assert.ok(unk.value >= 1) // at least one unknown field observed
})

test('negative: removing/renaming required field breaks compatibility', () => {
  // price removed/renamed → consumer should reject
  const broken = { ts_ms: 333, symbol: 'ESZ5' }
  assert.throws(() => decodeTick(broken))
})

test('degrade metric can be recorded', () => {
  const reg = new MetricsRegistry()
  const deg = reg.counter(MetricNames.ui_degrade_events)
  deg.inc()
  const snap = reg.snapshot()
  assert.equal(snap.counters[MetricNames.ui_degrade_events], 1)
})
