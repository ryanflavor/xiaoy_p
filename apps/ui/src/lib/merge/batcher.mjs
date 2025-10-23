/**
 * Timed batcher with de-duplication and simple priority throttling.
 * - Interval: flush every ~intervalMs (default 16ms), but never slower than configured max for consumers.
 * - De-duplication: last-wins per key within the interval window.
 * - Priority: 'high' always flushes; 'low' can be throttled by lowPriorityThrottle (e.g., every 2nd flush).
 */

export class Batcher {
  /** @type {Map<string, {key:string, payload:any, priority:'high'|'normal'|'low', ts:number}>} */
  #pending = new Map()
  #timer = null
  #running = false
  #flushIndex = 0
  #firstEnqueueTs = null
  #onFlush = null

  constructor (opts = {}) {
    const {
      intervalMs = 16,
      lowPriorityThrottle = 2,
      schedule = (fn, ms) => setTimeout(fn, ms),
      now = () => Date.now(),
    } = opts

    this.opts = { intervalMs, lowPriorityThrottle, schedule, now }
    this.metrics = {
      enqueued: 0,
      merged: 0,
      dropped: 0,
      flushes: 0,
      // simple rolling latency samples (ms)
      latencies: [], maxSamples: 128,
    }
  }

  /**
   * Add/merge an item into current batch.
   * @param {string} key unique key for de-duplication
   * @param {any} payload data
   * @param {'high'|'normal'|'low'} [priority='normal']
   */
  add (key, payload, priority = 'normal') {
    if (this.#pending.size === 0) this.#firstEnqueueTs = this.opts.now()
    this.metrics.enqueued++
    if (this.#pending.has(key)) this.metrics.merged++
    this.#pending.set(key, { key, payload, priority, ts: this.opts.now() })
    if (!this.#running) this.start()
  }

  /** Start timer-driven flushing. */
  start () {
    if (this.#running) return
    this.#running = true
    const tick = () => {
      this.#timer = null
      this.flushOnce()
      if (this.#running) this.#timer = this.opts.schedule(tick, this.opts.intervalMs)
    }
    this.#timer = this.opts.schedule(tick, this.opts.intervalMs)
  }

  /** Stop timer-driven flushing. */
  stop () {
    this.#running = false
    if (this.#timer != null) {
      try { if (typeof clearTimeout === 'function') clearTimeout(this.#timer) } catch { void 0 }
      try { if (typeof clearImmediate === 'function') clearImmediate(this.#timer) } catch { void 0 }
    }
    this.#timer = null
  }

  /**
   * Flush once immediately. Calls onFlush if set.
   * @returns {Array<{key:string, payload:any, priority:string}>}
   */
  flushOnce () {
    this.#flushIndex++
    if (this.#pending.size === 0) return []

    const allowLow = (this.#flushIndex % (this.opts.lowPriorityThrottle || 1)) === 0
    const items = []
    for (const it of this.#pending.values()) {
      if (it.priority === 'low' && !allowLow) continue
      items.push({ key: it.key, payload: it.payload, priority: it.priority })
    }
    // Remove emitted items; keep deferred lows for a later cycle
    for (const it of items) this.#pending.delete(it.key)

    if (items.length > 0) {
      this.metrics.flushes++
      if (this.#firstEnqueueTs != null) {
        const dwell = this.opts.now() - this.#firstEnqueueTs
        const lat = Math.max(0, dwell)
        this.metrics.latencies.push(lat)
        if (this.metrics.latencies.length > this.metrics.maxSamples) this.metrics.latencies.shift()
      }
      this.#firstEnqueueTs = this.#pending.size > 0 ? this.opts.now() : null
      if (this.#onFlush) this.#onFlush(items)
    }

    return items
  }

  /**
   * Register a flush handler.
   * @param {(items:Array<{key:string,payload:any,priority:string}>)=>void} handler
   */
  on (handler) { this.#onFlush = handler }

  get size () { return this.#pending.size }
}

/** Compute simple stats from latency samples. */
export function latencyStats (samples) {
  if (!samples || samples.length === 0) return { count: 0, p50: 0, p95: 0, p99: 0, avg: 0 }
  const sorted = [...samples].sort((a, b) => a - b)
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))]
  const sum = sorted.reduce((a, b) => a + b, 0)
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), avg: sum / sorted.length }
}
