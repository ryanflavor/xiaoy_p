import assert from 'node:assert'
import { test } from 'node:test'
import { errorBudgetMs, badTimeFromSamples, burnRate, evaluateSnapshot, computeBurnRates } from '../src/lib/slo.mjs'

test('errorBudgetMs computes time allowed per window', () => {
  assert.equal(errorBudgetMs(300000, 0.999), 300) // 5m * 0.1% = 300ms
  assert.equal(errorBudgetMs(3600000, 0.999), 3600) // 1h * 0.1% = 3.6s
})

test('badTimeFromSamples integrates boolean intervals', () => {
  const now = 10_000
  const win = 1000
  const samples = [
    { ts: now - 900, bad: false },
    { ts: now - 800, bad: true },
    { ts: now - 200, bad: false },
  ]
  // bad from t=[now-800, now-200] => 600ms
  assert.equal(badTimeFromSamples(samples, now, win), 600)
})

test('burnRate handles zero budget', () => {
  assert.equal(burnRate(0, 0), 0)
  assert.equal(burnRate(1, 0), Infinity)
})

test('evaluateSnapshot returns proper levels', () => {
  const cfg = {
    latency: { p95Warn: 120, p99Crit: 180 },
    fps: { warn: 30, crit: 20 },
    slowConsumers: { warn: 1, crit: 3 },
  }
  // OK
  let r = evaluateSnapshot({ fps: 60, e2eLatency: { p95: 100, p99: 150 }, slowConsumers: 0 }, cfg)
  assert.equal(r.level, 'ok')
  // WARN on p95
  r = evaluateSnapshot({ fps: 60, e2eLatency: { p95: 121, p99: 150 }, slowConsumers: 0 }, cfg)
  assert.equal(r.level, 'warn')
  assert.equal(r.details.latencyP95, 'warn')
  // CRIT on p99
  r = evaluateSnapshot({ fps: 60, e2eLatency: { p95: 121, p99: 181 }, slowConsumers: 0 }, cfg)
  assert.equal(r.level, 'crit')
  assert.equal(r.details.latencyP99, 'crit')
  // CRIT on fps and slowConsumers
  r = evaluateSnapshot({ fps: 10, e2eLatency: { p95: 100, p99: 150 }, slowConsumers: 5 }, cfg)
  assert.equal(r.level, 'crit')
  assert.equal(r.details.fps, 'crit')
  assert.equal(r.details.slowConsumers, 'crit')
})

test('computeBurnRates calculates 5m/1h rates', () => {
  const cfg = { errorBudget: { window5mMs: 300000, window1hMs: 3600000, targetAvailability: 0.999 } }
  const now = Date.now()
  const samples = []
  // Mark last 150ms as bad
  samples.push({ ts: now - 200, bad: false })
  samples.push({ ts: now - 150, bad: true })
  samples.push({ ts: now - 0, bad: true })
  const res = computeBurnRates(samples, now, cfg)
  assert.ok(res.burn5m > 0 && res.burn5m < 1) // 150ms / 300ms budget
})
