import { test, expect } from '@playwright/test'
import http from 'node:http'

const LIVE = process.env.E2E_LIVE === '1'
test.skip(!LIVE, 'Requires live gateway at :8080')

async function scrapeMetrics(): Promise<Record<string, number>> {
  const text: string = await new Promise((resolve, reject) => {
    http.get('http://localhost:8080/metrics', res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => resolve(d))
    }).on('error', reject)
  })
  const map: Record<string, number> = {}
  for (const ln of text.split(/\n+/)) {
    if (!ln || ln.startsWith('#')) continue
    const [raw, val] = ln.trim().split(/\s+/)
    if (!raw || !val) continue
    const name = raw.replace(/\{.*\}$/,'')
    const num = Number(val)
    if (!Number.isNaN(num)) map[name] = num
  }
  return map
}

test('live gateway metrics indicate active push', async () => {
  const a = await scrapeMetrics()
  await new Promise(r => setTimeout(r, 1500))
  const b = await scrapeMetrics()
  const fA = a['xy_ws_messages_forwarded_total'] || 0
  const fB = b['xy_ws_messages_forwarded_total'] || 0
  const rate = b['ws_msgs_rate'] || 0
  // Expect forwarded messages increased and rate reported non-zero
  expect(fB - fA).toBeGreaterThan(0)
  expect(rate).toBeGreaterThan(0)
})

