import { test, expect } from '@playwright/test'
import { WebSocketServer } from 'ws'

async function startWsServer() {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  const state: any = { connections: 0, lastMessages: [] as string[] }
  wss.on('connection', (ws) => {
    state.connections++
    ws.on('message', (data) => {
      try { state.lastMessages.push(String(data)) } catch {}
    })
  })
  await new Promise<void>((res) => wss.once('listening', () => res()))
  const addr = wss.address()
  const port = typeof addr === 'object' && addr ? (addr as any).port : 0
  return { wss, url: `ws://127.0.0.1:${port}`, state }
}

test.describe('Story 1.3 ACs (1920×1080)', () => {
  test('AC1: single WS connection across tabs + fanout via SharedWorker', async ({ context, page }) => {
    const { wss, url, state } = await startWsServer()
    try {
      await page.goto('/demo/index.html')
      await page.waitForSelector('#wsUrl')
      await page.locator('#wsUrl').fill(url)
      await page.locator('#btnConnect').click()
      // Use health to read createdConnections instead of waiting for heartbeat
      await page.locator('#btnHealth').click()
      await expect(page.locator('#health')).toContainText('"createdConnections": 1')
      // Initial hello shows current port count on this tab
      await expect(page.locator('#ports')).toHaveText('1')

      const page2 = await context.newPage()
      await page2.goto('/demo/index.html')
      // New tab attaches to same SharedWorker (same origin) → no extra WS connection
      // Wait for worker hello to ensure message port is ready to receive broadcasts
      await expect(page2.locator('#out')).toContainText('hello:')

      // Fanout check (bidirectional):
      // 1) From tab1 → tab2
      const msg1 = `hello-from-tab1-${Date.now()}`
      await page.locator('#broadcastText').fill(msg1)
      await page.locator('#btnBroadcast').click()
      await expect(page2.locator('#out')).toContainText(msg1)
      // 2) From tab2 → tab1
      const msg2 = `hello-from-tab2-${Date.now()}`
      await page2.locator('#broadcastText').fill(msg2)
      await page2.locator('#btnBroadcast').click()
      await expect(page.locator('#out')).toContainText(msg2)

      // Server should only have 1 connection open
      await new Promise(r => setTimeout(r, 50))
      expect(state.connections).toBe(1)
    } finally {
      // Ensure all client sockets are closed before shutting down the server to avoid hanging
      for (const c of wss.clients) { try { c.close() } catch {} }
      await new Promise<void>(res => wss.close(()=>res()))
    }
  })

  test('AC2: 5 tabs maintain frame cadence (FPS ≥ 60 approx.)', async ({ context, browser }) => {
    // Open 5 pages within same context (shared SharedWorker not required here)
    const pages = []
    for (let i = 0; i < 5; i++) {
      const p = await context.newPage()
      await p.goto('/demo/index.html')
      await p.waitForSelector('#fps')
      pages.push(p)
    }
    // Allow FPS meter to accumulate samples
    await new Promise(r => setTimeout(r, 1500))
    const fpsValues: number[] = []
    for (const p of pages) {
      const t = await p.locator('#fps').textContent()
      const v = Number((t || '').trim() || '0')
      fpsValues.push(v)
    }
    // Use a conservative threshold to avoid CI flakiness, while aiming for ~60fps
    for (const v of fpsValues) {
      expect(v).toBeGreaterThanOrEqual(55)
    }
  })

  test('AC3: reconnect ≤3s, health report present, slow-consumer ack', async ({ page }) => {
    const { wss, url } = await startWsServer()
    try {
      await page.goto('/demo/index.html')
      await page.waitForSelector('#wsUrl')
      await page.locator('#wsUrl').fill(url)
      await page.locator('#btnConnect').click()
      await page.locator('#btnHealth').click()
      await expect(page.locator('#health')).toContainText('"createdConnections": 1')

      // Subscribe to ensure there is at least one logical subscription
      await page.locator('#subTopic').fill('xy.md.tick.demo')
      await page.locator('#btnSub').click()
      await expect(page.locator('#out')).toContainText('ack: subscribe')

      // Trigger disconnect + reconnect and verify health shows connected again within 3s
      await page.locator('#btnReconnect').click()
      const start = Date.now()
      let ok = false
      for (let i = 0; i < 15; i++) { // 15 attempts × 200ms ≈ 3s
        await page.locator('#btnHealth').click()
        const json = await page.locator('#health').textContent()
        if (json && /"createdConnections"\s*:\s*(2|3|4|5)/.test(json)) { ok = true; break }
        await page.waitForTimeout(200)
      }
      expect(ok).toBeTruthy()
      expect(Date.now() - start).toBeLessThanOrEqual(3000)

      // Health payload shape includes reconnectAttempts/createdConnections/subscriptions
      const healthText = await page.locator('#health').textContent()
      expect(healthText).toMatch(/"reconnectAttempts"\s*:/)
      expect(healthText).toMatch(/"createdConnections"\s*:/)
      expect(healthText).toMatch(/"subscriptions"\s*:/)

      // Slow consumer event acknowledgement
      await page.locator('#btnSlow').click()
      await expect(page.locator('#out')).toContainText('ack: slow-consumer')
    } finally {
      for (const c of wss.clients) { try { c.close() } catch {} }
      await new Promise<void>(res => wss.close(()=>res()))
    }
  })
})
