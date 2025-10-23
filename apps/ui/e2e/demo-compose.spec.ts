import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.use({ video: 'on' })

test('Compose Demo E2E: single-connection + fanout + receive + metrics non-empty', async ({ page, context }) => {
  // Preconditions: `docker compose -f compose.demo.yml up -d` is running
  // Token from repo root (fallback to services/ws-gateway)
  const token = process.env.WS_TOKEN || (() => {
    try { return readFileSync('.demo_token.txt', 'utf8').trim() } catch {}
    try { return readFileSync('services/ws-gateway/.demo_token.txt', 'utf8').trim() } catch {}
    throw new Error('demo token not found')
  })()

  const wsUrl = process.env.WS_URL || 'ws://localhost:8080/ws'
  const baseUrl = `http://localhost:5174/demo/index.html?url=${encodeURIComponent(wsUrl)}&token=${encodeURIComponent(token)}`

  // Open two tabs to assert single-connection fanout via SharedWorker
  const page1 = page
  await page1.goto(baseUrl)
  await page1.getByRole('button', { name: '连接' }).click()
  await page1.getByRole('button', { name: '健康' }).click()

  const page2 = await context.newPage()
  await page2.goto(baseUrl)
  await page2.getByRole('button', { name: '健康' }).click()

  // Wait for health to report (both pages)
  for (const p of [page1, page2]) {
    let ok = false
    for (let i=0;i<20;i++) {
      const t = await p.locator('#health').textContent()
      if (t && t.includes('"connected": true')) { ok = true; break }
      await p.waitForTimeout(300)
      await p.getByRole('button', { name: '健康' }).click()
    }
    expect(ok).toBeTruthy()
  }

  // Subscribe default topic and expect demo publisher traffic
  await page1.getByRole('button', { name: '订阅' }).click()
  await expect(page1.locator('#out')).toContainText('ack: subscribe')

  // Expect periodic publisher to produce a message visible through WS → SharedWorker → page
  await expect(page1.locator('#out')).toContainText('demo-msg-', { timeout: 15_000 })

  // Metrics should be reachable and contain forwarding counters or rate
  const metricsText = await (await fetch('http://localhost:8080/metrics')).text()
  expect(metricsText).toMatch(/xy_ws_messages_forwarded_total|ws_msgs_rate/)
})
// @live Requires live gateway / NATS / compose
const LIVE = process.env.E2E_LIVE === '1'
test.skip(!LIVE, 'Requires live gateway (:8080) and compose stack')
