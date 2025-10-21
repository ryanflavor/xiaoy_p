import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'

test('contracts repo contains buf.yaml and schemas', () => {
  const buf = readFileSync('packages/contracts/buf.yaml', 'utf8')
  assert.match(buf, /version:\s*v2/)
  statSync('packages/contracts/proto/xy/md/v1/tick.proto')
  statSync('packages/contracts/proto/xy/md/v1/snapshot.proto')
  statSync('packages/contracts/fbs/xy/md/tick.fbs')
})

test('CI contains buf breaking workflow', () => {
  const yml = readFileSync('.github/workflows/buf-breaking.yml', 'utf8')
  assert.match(yml, /buf breaking/)
})
