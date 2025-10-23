import test from 'node:test'
import assert from 'node:assert/strict'
import { rankGroups } from '../src/lib/topn.mjs'

test('rankGroups sorts by combined score', () => {
  const slow = { 'xy.md.1': 0, 'xy.md.2': 2, 'xy.md.3': 1 }
  const p95 = { 'xy.md.1': 300, 'xy.md.2': 100, 'xy.md.3': 500 }
  const arr = rankGroups(slow, p95)
  // scores: g1=0+3=3, g2=2+1=3, g3=1+5=6
  assert.equal(arr[0].g, 'xy.md.3')
  assert.ok(arr[0].score > arr[1].score || arr[0].score === 6)
  assert.ok(arr.find(x => x.g === 'xy.md.1'))
  assert.ok(arr.find(x => x.g === 'xy.md.2'))
})

