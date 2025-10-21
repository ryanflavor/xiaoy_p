import test from 'node:test'
import assert from 'node:assert/strict'
import { WSManager } from '../src/lib/ws/manager.mjs'

function mockSocket() {
  const listeners = new Map()
  return {
    readyState: 1,
    send: () => {},
    close: () => {
      const cb = listeners.get('close')
      if (cb) cb()
    },
    addEventListener: (evt, cb) => listeners.set(evt, cb),
    removeEventListener: (evt) => listeners.delete(evt),
  }
}

test('WSManager creates only one socket instance', { timeout: 500 }, () => {
  const a = WSManager.connect({ url: 'wss://example', factory: () => mockSocket() })
  const b = WSManager.connect({ url: 'wss://example', factory: () => mockSocket() })
  assert.equal(a, b, 'manager must return the same instance')
  assert.equal(WSManager.createdConnections, 1, 'should create exactly one connection')
})

test('WSManager resets on close', { timeout: 500 }, () => {
  const s = WSManager.connect({ url: 'wss://example', factory: () => mockSocket() })
  s.close()
  const n = WSManager.connect({ url: 'wss://example', factory: () => mockSocket() })
  assert.notEqual(s, n, 'new instance after close')
  assert.equal(WSManager.createdConnections, 2)
})
