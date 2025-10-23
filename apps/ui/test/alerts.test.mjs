import assert from 'node:assert'
import { test } from 'node:test'
import { evaluateAndEmit } from '../src/lib/alerts.mjs'

const cfg = {
  latency: { p95Warn: 120, p99Crit: 180 },
  fps: { warn: 30, crit: 20 },
  slowConsumers: { warn: 1, crit: 3 },
}

test('evaluateAndEmit triggers callbacks', () => {
  let warn = 0, crit = 0, records = []
  const snapshot = { fps: 15, e2eLatency: { p50: 50, p95: 100, p99: 150 }, slowConsumers: 0 }
  const res = evaluateAndEmit(snapshot, cfg, {
    onWarn: () => warn++,
    onCrit: () => crit++,
    recorder: (e) => records.push(e),
  })
  assert.equal(res.level, 'crit')
  assert.equal(warn, 0)
  assert.equal(crit, 1)
  assert.equal(records.length, 1)
})

