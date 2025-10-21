import test from 'node:test'
import assert from 'node:assert/strict'
import { registry, querySnapshot, subscribe, uiFpsGauge, e2eLatency, slowConsumers } from '../src/lib/metrics/api.mjs'

test('metrics API query and subscribe provide values', async () => {
  // seed some values
  slowConsumers.inc()
  e2eLatency.observe(100)
  e2eLatency.observe(130)
  let called = 0
  const unsub = subscribe((snap) => { called++; assert.ok(snap.gauges !== undefined) }, 50)
  await new Promise(r => setTimeout(r, 120))
  unsub()
  const snap = querySnapshot()
  assert.equal(snap.counters.ui_slow_consumers, 1)
  assert.ok(snap.latencies.ui_e2e_latency_ms.p95 >= 100)
  assert.ok(called >= 2)
})

