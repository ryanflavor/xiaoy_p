import test from 'node:test'
import assert from 'node:assert/strict'
import { checkSABSafe } from '../src/lib/compat/sab-check.mjs'

test('SAB safety check passes when SAB disabled', { timeout: 300 }, () => {
  const res = checkSABSafe({ SharedArrayBuffer: undefined, crossOriginIsolated: false })
  assert.equal(res.enabled, false)
  assert.equal(res.ok, true)
})
