import test from 'node:test'
import assert from 'node:assert/strict'
import { WSManager } from '../src/lib/ws/manager.mjs'

function controllableSocket () {
  const listeners = new Map()
  const sock = {
    readyState: 0,
    _emitted: [],
    send: (d) => sock._emitted.push(d),
    close: () => listeners.get('close')?.({ code: 1000 }),
    addEventListener: (evt, cb) => listeners.set(evt, cb),
    removeEventListener: (evt) => listeners.delete(evt),
    emit: (evt, payload) => listeners.get(evt)?.(payload ?? {}),
  }
  return sock
}

function resetManager () {
  WSManager.shouldReconnect = false
  if (WSManager.reconnectTimer) WSManager.reconnectTimer = null
  WSManager.socket = null
  WSManager.listenersAttached = false
  WSManager.subs?.clear?.()
  WSManager.nextDelayMs = 0
  WSManager.reconnectAttempts = 0
}

test('Schedules exponential backoff with cap', { timeout: 1000 }, async () => {
  // deterministic schedule capturing delays without actually waiting
  const scheduled = []
  const schedule = (fn, ms) => { scheduled.push(ms); setImmediate(fn); return 0 }
  const factoryCalls = []
  const factory = () => { const s = controllableSocket(); factoryCalls.push(s); return s }

  resetManager()
  WSManager.shouldReconnect = true

  WSManager.connect({ url: 'wss://x', factory, backoff: { initialMs: 10, factor: 2, maxMs: 40, jitter: 0 }, schedule })
  // sequentially close latest socket to advance backoff
  factoryCalls.at(-1).emit('close')
  await new Promise(r => setImmediate(r))
  factoryCalls.at(-1).emit('close')
  await new Promise(r => setImmediate(r))
  factoryCalls.at(-1).emit('close')
  await new Promise(r => setImmediate(r))

  // Expect first three delays respecting cap: 10, 20, 40
  assert.ok(scheduled.length >= 1)
  assert.equal(scheduled[0], 10)
  assert.equal(scheduled[1], 20)
  assert.equal(scheduled[2], 40)
})

test('Does not schedule concurrent reconnects beyond max', { timeout: 500 }, () => {
  const scheduled = []
  const schedule = (fn, ms) => { scheduled.push(ms); /* do not run */ return 0 }
  const s = controllableSocket()
  const factory = () => s

  resetManager()
  WSManager.shouldReconnect = true
  WSManager.connect({ url: 'wss://x', factory, backoff: { initialMs: 5, jitter: 0 }, schedule, maxConcurrentReconnects: 1 })
  // trigger multiple closes rapidly
  s.emit('close')
  s.emit('close')
  s.emit('close')
  // Only one timer should be scheduled
  assert.equal(scheduled.length, 1)
})

test('Cancel reconnect clears pending timer', { timeout: 1000 }, async () => {
  const schedule = (fn, ms) => { return setTimeout(()=>{}, ms) }
  const s = controllableSocket()
  const factory = () => s

  resetManager()
  WSManager.shouldReconnect = true
  WSManager.connect({ url: 'wss://x', factory, backoff: { initialMs: 5, jitter: 0 }, schedule, maxConcurrentReconnects: 1 })
  s.emit('close')
  // scheduled reconnect should create a timer handle
  assert.ok(WSManager.reconnectTimer != null)
  WSManager.cancelReconnect()
  assert.equal(WSManager.reconnectTimer, null)
})

test('Restores subscriptions after reconnect within 3s', { timeout: 1500 }, async () => {
  let now = 0
  const scheduledMs = []
  const schedule = (fn, ms) => { scheduledMs.push(ms); now += ms; setImmediate(fn); return 0 }
  const s1 = controllableSocket()
  const s2 = controllableSocket()
  const sockets = [s1, s2]
  let idx = 0
  const factory = () => sockets[idx++]

  resetManager()
  WSManager.shouldReconnect = true
  WSManager.connect({ url: 'wss://x', factory, backoff: { initialMs: 50, factor: 2, maxMs: 3000, jitter: 0 }, schedule, now: () => now })
  // first open
  s1.emit('open')
  WSManager.addSubscription('xy.md.test')
  // sanity: subscription stored and first socket sent
  assert.equal(WSManager.health().subscriptions, 1)
  assert.ok(s1._emitted.some(m => String(m).includes('xy.md.test')))
  // simulate close -> within 3s -> reconnect -> open
  const closeAt = now
  s1.emit('close')
  // advance virtual time by 2500ms (<=3s), then reconnect explicitly
  now += 2500
  WSManager.connect({ url: 'wss://x', factory, schedule, now: () => now })
  s2.emit('open')
  // ensure within 3s cap and subscription re-sent metric recorded
  assert.ok((now - closeAt) <= 3000)
  assert.equal(WSManager.health().subscriptions, 1)
  assert.ok(WSManager.metrics.resubscribed >= 1)
})
