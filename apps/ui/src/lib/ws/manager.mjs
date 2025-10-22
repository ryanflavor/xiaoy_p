/**
 * Single-connection WebSocket manager usable from a SharedWorker
 * - Ensures only one WebSocket is ever created per worker process
 * - Injection-friendly for tests via factory/schedule/now options
 * - AC3: exponential backoff reconnect with cap and concurrency guard; subscription restore; health metrics
 */

/** @typedef {{readyState:number, close:()=>void, send:(d:any)=>void, addEventListener:(e:string, cb:Function)=>void, removeEventListener:(e:string, cb:Function)=>void}} WSLike */

class WebSocketManager {
  /** @type {WSLike|null} */
  socket = null
  connectCount = 0
  listenersAttached = false
  shouldReconnect = true
  reconnectTimer = null
  reconnectAttempts = 0
  nextDelayMs = 0
  concurrentReconnects = 0
  lastError = null
  lastCloseTs = 0
  /** @type {Set<string>} */
  subs = new Set()
  /** @type {{enqueued:number, merged:number, dropped:number, flushes:number, latencies:number[], resubscribed:number}} */
  metrics = { enqueued:0, merged:0, dropped:0, flushes:0, latencies:[], resubscribed: 0 }

  constructor() {
    this.cfg = {
      backoff: { initialMs: 100, factor: 2, maxMs: 3000, jitter: 0.2 },
      maxConcurrentReconnects: 1,
      schedule: (fn, ms) => setTimeout(fn, ms),
      now: () => Date.now(),
      makeWS: (u, p) => new globalThis.WebSocket(u, p),
    }
    /** @type {(ev: any) => void} */
    this.onMessage = null
    this.lastCloseCode = null
    this.lastCloseReason = null
  }

  /** @returns {WSLike|null} */
  get instance() { return this.socket }

  /** @returns {number} */
  get createdConnections() { return this.connectCount }

  /**
   * @param {{url:string, protocols?:string[], factory?:(url:string, protocols?:string[])=>WSLike, backoff?:{initialMs?:number,factor?:number,maxMs?:number,jitter?:number}, maxConcurrentReconnects?:number, schedule?:(fn:Function,ms:number)=>any, now?:()=>number}} opts
   * @returns {WSLike}
   */
  connect (opts) {
    if (this.socket) return this.socket

    const { url, protocols, factory, backoff, maxConcurrentReconnects, schedule, now } = opts
    if (backoff) Object.assign(this.cfg.backoff, backoff)
    if (typeof maxConcurrentReconnects === 'number') this.cfg.maxConcurrentReconnects = maxConcurrentReconnects
    if (schedule) this.cfg.schedule = schedule
    if (now) this.cfg.now = now

    const create = factory ?? this.cfg.makeWS
    const ws = create(url, protocols)
    this.socket = ws
    this.connectCount++
    if (!this.nextDelayMs) this.nextDelayMs = this.cfg.backoff.initialMs

    try {
      ws.addEventListener('open', () => {
        this.reconnectAttempts = 0
        this.nextDelayMs = this.cfg.backoff.initialMs
        // restore subscriptions
        try {
          let count = 0
          for (const topic of this.subs) {
            // server expects an array field 'subjects'
            ws.send(JSON.stringify({ type: 'subscribe', subjects: [topic] }))
            count++
          }
          if (count > 0) this.metrics.resubscribed += count
        } catch {}
      })
      ws.addEventListener('message', (ev) => {
        try { if (typeof this.onMessage === 'function') this.onMessage(ev) } catch {}
      })
      ws.addEventListener('close', (ev) => {
        try {
          this.lastCloseCode = ev?.code ?? null
          this.lastCloseReason = ev?.reason ?? null
        } catch {}
        this.socket = null
        this.lastCloseTs = this.cfg.now()
        if (this.shouldReconnect) this.#scheduleReconnect(url, protocols, factory)
      })
      ws.addEventListener('error', (e) => {
        this.lastError = e
      })
      this.listenersAttached = true
    } catch {}
    return ws
  }

  /** Intentionally disconnect. */
  disconnect ({ reconnect = false } = {}) {
    this.shouldReconnect = !!reconnect
    try { this.socket?.close?.() } catch {}
    if (!reconnect) this.cancelReconnect()
  }

  /** Add logical subscription to be restored after reconnect. */
  addSubscription (topic) {
    this.subs.add(topic)
    if (this.socket) try { this.socket.send(JSON.stringify({ type:'subscribe', subjects: [topic] })) } catch {}
  }
  removeSubscription (topic) {
    this.subs.delete(topic)
    if (this.socket) try { this.socket.send(JSON.stringify({ type:'unsubscribe', subjects: [topic] })) } catch {}
  }

  /** Record slow consumer metric. */
  recordSlowConsumer () { this.metrics.dropped++; }

  /** Cancel any scheduled reconnect timer. */
  cancelReconnect () {
    if (this.reconnectTimer != null) {
      try { if (typeof clearTimeout === 'function') clearTimeout(this.reconnectTimer) } catch {}
      try { if (typeof clearImmediate === 'function') clearImmediate(this.reconnectTimer) } catch {}
    }
    this.reconnectTimer = null
    this.concurrentReconnects = 0
  }

  /** Health snapshot for diagnostics. */
  health () {
    return {
      connected: !!(this.socket && this.socket.readyState === 1),
      readyState: this.socket ? this.socket.readyState : -1,
      reconnectAttempts: this.reconnectAttempts,
      nextDelayMs: this.nextDelayMs,
      createdConnections: this.connectCount,
      subscriptions: this.subs.size,
      lastCloseTs: this.lastCloseTs,
      lastError: this.lastError ? String(this.lastError?.message || this.lastError) : null,
      lastCloseCode: this.lastCloseCode,
      lastCloseReason: this.lastCloseReason,
    }
  }

  #scheduleReconnect (url, protocols, factory) {
    if (this.reconnectTimer) return
    if (this.concurrentReconnects >= this.cfg.maxConcurrentReconnects) return
    this.concurrentReconnects++
    const base = this.nextDelayMs || this.cfg.backoff.initialMs
    const jitter = this.cfg.backoff.jitter ?? 0
    const jitterDelta = base * jitter * (Math.random() * 2 - 1)
    const delay = Math.max(0, Math.min(this.cfg.backoff.maxMs, Math.floor(base + jitterDelta)))
    this.reconnectTimer = this.cfg.schedule(() => {
      this.reconnectTimer = null
      try {
        this.connect({ url, protocols, factory })
        this.reconnectAttempts++
        this.nextDelayMs = Math.min(this.cfg.backoff.maxMs, (this.nextDelayMs || base) * (this.cfg.backoff.factor || 2))
      } finally {
        this.concurrentReconnects = Math.max(0, this.concurrentReconnects - 1)
      }
    }, delay)
  }
}

export const WSManager = new WebSocketManager()
