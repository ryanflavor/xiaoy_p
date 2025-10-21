import test from 'node:test'
import assert from 'node:assert/strict'
import { Batcher, latencyStats } from '../src/lib/merge/batcher.mjs'
import { performance } from 'node:perf_hooks'

test('Batcher de-duplicates by key (last-wins)', { timeout: 500 }, () => {
  // use a no-op scheduler to avoid background timers in this test
  const b = new Batcher({ intervalMs: 1000, schedule: () => 0 })
  const seen = []
  b.on(items => seen.push(items))
  b.add('k1', { n: 1 })
  b.add('k1', { n: 2 })
  b.add('k2', { n: 3 })

  const out = b.flushOnce()
  assert.equal(out.length, 2)
  const m = new Map(out.map(i => [i.key, i.payload.n]))
  assert.equal(m.get('k1'), 2, 'last write wins for k1')
  assert.equal(m.get('k2'), 3)
  assert.ok(b.metrics.merged >= 1)
  assert.ok(b.metrics.flushes >= 1)
  b.stop()
})

test('Batcher timer flush executes roughly on interval', { timeout: 1000 }, async () => {
  const interval = 10
  const b = new Batcher({ intervalMs: interval })
  const events = []
  b.on(items => events.push({ t: Date.now(), items }))
  b.add('a', 1)
  await new Promise(r => setTimeout(r, interval * 3))
  assert.ok(events.length >= 1)
  assert.equal(events[0].items.length, 1)
  const stats = latencyStats(b.metrics.latencies)
  assert.ok(stats.avg >= 0)
  b.stop()
})

test('Batch flush stays within 8ms budget (approx)', { timeout: 500 }, () => {
  const b = new Batcher({ intervalMs: 1000, schedule: () => 0 })
  for (let i=0;i<500;i++) b.add('k', i) // dedupe collapses to 1 item
  const t0 = performance.now()
  b.flushOnce()
  const t1 = performance.now()
  // On typical CI, this should be well below 8ms; adjust if needed
  assert.ok((t1 - t0) <= 8, `flush took ${(t1-t0).toFixed(2)}ms`)
  b.stop()
})

test('Low priority throttling defers emission', { timeout: 500 }, () => {
  const b = new Batcher({ intervalMs: 1000, lowPriorityThrottle: 2, schedule: () => 0 })
  b.add('h', 1, 'high')
  b.add('l', 2, 'low')
  let out = b.flushOnce()
  const keys1 = out.map(i => i.key)
  assert.deepEqual(keys1, ['h'])

  // Second flush — low should appear now
  out = b.flushOnce()
  const keys2 = out.map(i => i.key).sort()
  assert.deepEqual(keys2, ['l'])
  b.stop()
})
