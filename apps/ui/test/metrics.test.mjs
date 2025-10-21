import test from 'node:test'
import assert from 'node:assert/strict'
import { Counter, Gauge, LatencyTracker, createFpsMeter, MetricsRegistry, MetricNames } from '../src/lib/metrics/metrics.mjs'

test('LatencyTracker computes percentiles', () => {
  const l = new LatencyTracker(16)
  ;[10, 20, 30, 40, 50, 60, 70, 80].forEach(v => l.observe(v))
  const s = l.stats()
  assert.equal(s.count, 8)
  assert.equal(s.p50, 40)
  assert.ok(s.p95 >= 70)
  assert.ok(s.avg > 0)
})

test('FPS meter collects frames with injected scheduler', { timeout: 1000 }, async () => {
  let t = 0
  const meter = createFpsMeter({ now: ()=>t, schedule: (fn)=>{ t+=16; setImmediate(()=>fn(t)) } })
  meter.start()
  await new Promise(r => setTimeout(r, 50))
  meter.stop()
  const fps = meter.fps()
  assert.ok(fps >= 10, 'fps should be > 10 in simulated loop')
})

test('Registry snapshot shape and names', () => {
  const r = new MetricsRegistry()
  r.counter(MetricNames.ui_slow_consumers).inc()
  r.gauge(MetricNames.ui_fps, () => 60)
  const lt = r.latency(MetricNames.ui_e2e_latency_ms)
  lt.observe(100); lt.observe(120)
  const snap = r.snapshot()
  assert.equal(snap.counters[MetricNames.ui_slow_consumers], 1)
  assert.equal(snap.gauges[MetricNames.ui_fps], 60)
  assert.equal(snap.latencies[MetricNames.ui_e2e_latency_ms].count, 2)
})
