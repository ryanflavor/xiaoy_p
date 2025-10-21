import test from 'node:test'
import assert from 'node:assert/strict'
import { createFpsMeter, MetricsRegistry, MetricNames } from '../src/lib/metrics/metrics.mjs'
import { Batcher } from '../src/lib/merge/batcher.mjs'

test('Simulated 5 tabs maintain frame cadence and batching works (deterministic)', { timeout: 1200 }, async () => {
  // Deterministic virtual clock per meter + bounded scheduler (no reliance on wall clock)
  // 5 simulated tabs with independent virtual clocks
  function makeMeter() {
    let t = 0
    let left = 10
    const now = () => t
    const schedule = (fn) => { if (left-- > 0) setImmediate(() => { t += 16; fn(t) }) }
    return createFpsMeter({ now, schedule })
  }
  const meters = Array.from({length:5}, ()=>makeMeter())
  meters.forEach(m=>m.start())

  // Batcher merges duplicate subjects across tabs
  const b = new Batcher({ intervalMs: 16, schedule: (fn, ms)=>setTimeout(fn, ms) })
  let flushed = 0
  b.on(()=> { flushed += 1 })
  for (let i=0;i<20;i++) for (let j=0;j<5;j++) b.add('xy.md.tick.demo', { i, j })
  b.flushOnce(); b.flushOnce()

  // yield until all scheduled frames processed, then stop timers deterministically
  await new Promise(r => setTimeout(r, 50))
  meters.forEach(m=>m.stop())
  b.stop()

  const fpsAll = meters.map(m=>m.fps())
  // With deterministic 10 frames (~9 intervals) at 16ms, fps≈62
  fpsAll.forEach(fps => assert.ok(fps >= 60))
  assert.ok(flushed >= 1)

  const reg = new MetricsRegistry()
  reg.gauge(MetricNames.ui_fps, ()=> Math.round(fpsAll.reduce((a,b)=>a+b,0)/fpsAll.length))
  const snap = reg.snapshot()
  assert.ok(snap.gauges[MetricNames.ui_fps] >= 60)
})
