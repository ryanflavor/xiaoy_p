import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// 录制验证视频：连接→健康→订阅→看到消息→退订→确认停止
// 目标时长 ~30s（包含步骤与等待）
test.use({ video: 'on' })

test('Record 30s: connect/health/subscribe/messages/unsubscribe', async ({ page }) => {
  // 读取演示用 token
  const token = process.env.WS_TOKEN || (() => {
    try { return readFileSync('.demo_token.txt', 'utf8').trim() } catch {}
    try { return readFileSync('services/ws-gateway/.demo_token.txt', 'utf8').trim() } catch {}
    throw new Error('demo token not found')
  })()

  // 使用内网地址（与你的页面一致）
  const host = process.env.DEMO_HOST || 'localhost'
  const wsUrl = process.env.WS_URL || `ws://${host}:8080/ws`
  const baseUrl = `http://${host}:5174/demo/index.html?url=${encodeURIComponent(wsUrl)}&token=${encodeURIComponent(token)}`

  await page.goto(baseUrl)

  // 连接 + 健康
  await page.getByRole('button', { name: '连接' }).click()
  await page.getByRole('button', { name: '健康' }).click()
  await expect(page.locator('#health')).toContainText('"connected": true', { timeout: 15_000 })

  // 订阅并等待消息出现
  await page.getByRole('button', { name: '订阅' }).click()
  await expect(page.locator('#out')).toContainText('ack: subscribe', { timeout: 5_000 })
  await expect(page.locator('#out')).toContainText('demo-msg-', { timeout: 15_000 })

  // 等待几秒以清晰录到持续到达的消息
  await page.waitForTimeout(4_000)

  // 退订并验证不再有新消息（先等退订ACK，再观察静止）
  await page.getByRole('button', { name: '退订' }).click()
  await expect(page.locator('#out')).toContainText('ack: unsubscribe', { timeout: 5_000 })
  const stable = await page.locator('#out').textContent()
  await page.waitForTimeout(8_000)
  const stableAfter = await page.locator('#out').textContent()
  expect(stableAfter).toBe(stable)

  // 补足录像时间（总时长 ~30s）
  await page.waitForTimeout(15_000)
})
// @live Requires live gateway / recording against :8080
const LIVE = process.env.E2E_LIVE === '1'
test.skip(!LIVE, 'Requires live gateway (:8080)')
