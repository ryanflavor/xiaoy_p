/** Simple front-end metrics toolkit (Node-friendly with injected clocks) */

export class Counter {
  constructor (name) { this.name = name; this.value = 0 }
  inc (n = 1) { this.value += n }
  reset () { this.value = 0 }
}

export class Gauge {
  constructor (name, getFn = () => 0) { this.name = name; this.getFn = getFn; this.value = 0 }
  set (v) { this.value = v }
  get () { return this.getFn ? this.getFn() : this.value }
}

export class LatencyTracker {
  constructor (maxSamples = 512) { this.samples = []; this.max = maxSamples }
  observe (ms) { this.samples.push(ms); if (this.samples.length > this.max) this.samples.shift() }
  stats () {
    const s = [...this.samples].sort((a,b)=>a-b)
    if (s.length === 0) return { count:0, p50:0, p95:0, p99:0, avg:0 }
    const at = (p) => s[Math.min(s.length-1, Math.floor(p*(s.length-1)))]
    const sum = s.reduce((a,b)=>a+b,0)
    return { count:s.length, p50:at(0.5), p95:at(0.95), p99:at(0.99), avg:sum/s.length }
  }
}

/** FPS meter using raf when available, otherwise injected scheduler */
export function createFpsMeter (opts = {}) {
  const now = opts.now || (()=>Date.now())
  const raf = opts.raf || globalThis.requestAnimationFrame
  const schedule = opts.schedule || ((fn)=>setTimeout(()=>fn(now()), 16))
  const windowMs = opts.windowMs ?? 1000

  let running = false
  let lastTs = 0
  const frameTs = []

  const onFrame = (ts) => {
    if (!running) return
    const t = ts ?? now()
    frameTs.push(t)
    // drop old frames beyond window
    while (frameTs.length && (t - frameTs[0]) > windowMs) frameTs.shift()
    // schedule next
    if (typeof raf === 'function') raf(onFrame)
    else schedule(onFrame)
  }

  return {
    start () { if (running) return; running = true; lastTs = now(); (typeof raf==='function')? raf(onFrame) : schedule(onFrame) },
    stop () { running = false },
    fps () { if (frameTs.length < 2) return 0; const dt = (frameTs[frameTs.length-1] - frameTs[0]) || 1; return Math.round((frameTs.length-1) * 1000 / dt) },
    samples () { return frameTs.slice() },
  }
}

export class MetricsRegistry {
  constructor () { this.counters = new Map(); this.gauges = new Map(); this.latencies = new Map() }
  counter (name) { if (!this.counters.has(name)) this.counters.set(name, new Counter(name)); return this.counters.get(name) }
  gauge (name, getFn) { if (!this.gauges.has(name)) this.gauges.set(name, new Gauge(name, getFn)); return this.gauges.get(name) }
  latency (name) { if (!this.latencies.has(name)) this.latencies.set(name, new LatencyTracker()); return this.latencies.get(name) }
  snapshot () {
    const counters = {}; for (const [k,v] of this.counters) counters[k] = v.value
    const gauges = {}; for (const [k,g] of this.gauges) gauges[k] = g.get()
    const lat = {}; for (const [k,l] of this.latencies) lat[k] = l.stats()
    return { counters, gauges, latencies: lat }
  }
}

export const MetricNames = {
  // UI-side names aligned to gateway-style
  ui_fps: 'ui_fps',
  ui_slow_consumers: 'ui_slow_consumers',
  ui_e2e_latency_ms: 'ui_e2e_latency_ms',
  ui_unknown_fields: 'ui_unknown_fields',
  ui_degrade_events: 'ui_degrade_events',
}
