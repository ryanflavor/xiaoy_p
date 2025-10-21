import test from 'node:test'
import assert from 'node:assert/strict'

// Minimal DOM stub for overlay testing
const nodes = {}
globalThis.document = {
  createElement() {
    return {
      style: {},
      innerHTML: '',
      querySelector(sel) {
        if (!nodes[sel]) nodes[sel] = { textContent: '' }
        return nodes[sel]
      }
    }
  },
  body: { appendChild() {} }
}
globalThis.location = { search: '' }
globalThis.localStorage = { getItem() { return null }, setItem() {} }

import { attachMetricsOverlay } from '../src/overlay/metrics-overlay.mjs'

test('metrics overlay attaches and updates text', async () => {
  const unsub = attachMetricsOverlay({ enabled: true, intervalMs: 20 })
  // Wait for at least a couple of ticks
  await new Promise(r => setTimeout(r, 80))
  assert.ok(nodes['#xy-fps'] && nodes['#xy-fps'].textContent.startsWith('FPS:'), 'FPS text present')
  assert.ok(nodes['#xy-lat'] && nodes['#xy-lat'].textContent.includes('e2e'), 'Latency text present')
  assert.ok(nodes['#xy-slow'] && nodes['#xy-slow'].textContent.startsWith('slow:'), 'Slow text present')
  unsub()
})

