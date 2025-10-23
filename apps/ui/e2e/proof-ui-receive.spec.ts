import { test, expect } from '@playwright/test'
test.use({ video: 'on' })
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

test('Proof: UI subscribes and receives gateway message', async ({ page }) => {
  const token = readFileSync('services/ws-gateway/.demo_token.txt', 'utf8').trim()
  const subject = 'xy.md.demo'
  const payload = `ui-proof-${Date.now()}`
  const url = `http://localhost:5174/demo/index.html?url=ws://127.0.0.1:18080/ws&token=${encodeURIComponent(token)}`

  await page.goto(url)
  await page.getByRole('button', { name: '连接' }).click()

  // Await connected
  let connected = false
  for (let i=0;i<20;i++) {
    await page.getByRole('button', { name: '健康' }).click()
    const t = await page.locator('#health').textContent()
    if (t && t.includes('"connected": true')) { connected = true; break }
    await page.waitForTimeout(250)
  }
  expect(connected).toBeTruthy()

  // Subscribe
  await page.locator('#subTopic').fill(subject)
  await page.getByRole('button', { name: '订阅' }).click()
  await expect(page.locator('#out')).toContainText(`ack: subscribe ${subject}`)

  // Publish
  await new Promise<void>((resolve, reject) => {
    const pub = spawn('bash', ['-lc', `SUBJECT=${subject} node services/ws-gateway/examples/publish.mjs "${payload}"`])
    pub.on('exit', (c) => c===0? resolve() : reject(new Error('publish failed')))
  })

  // Expect arrival
  await expect(page.locator('#out')).toContainText(payload)
  // Keep a few frames so the video captures the payload on screen
  await page.waitForTimeout(1000)
  await page.screenshot({ path: test.info().outputPath('proof-received.png') })
})
// @live Requires live gateway on dynamic port (:18080 in test)
const LIVE = process.env.E2E_LIVE === '1'
test.skip(!LIVE, 'Requires live gateway (:18080)')
