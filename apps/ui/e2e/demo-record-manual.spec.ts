import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// 录制验证视频（不使用 URL 自动连接；手动输入 URL/Token 再操作）
test.use({ video: 'on' })

test('Record manual: open -> connect -> health -> subscribe -> messages -> unsubscribe -> stop', async ({ page }) => {
  const token = process.env.WS_TOKEN || (() => {
    try { return readFileSync('.demo_token.txt', 'utf8').trim() } catch {}
    try { return readFileSync('services/ws-gateway/.demo_token.txt', 'utf8').trim() } catch {}
    throw new Error('demo token not found')
  })()

  const host = process.env.DEMO_HOST || 'localhost'

  // 打开页面（无参数，避免自动连接）
  await page.goto(`http://${host}:5174/demo/index.html`)
  await page.waitForTimeout(400)

  // 初始健康应为空或 connected:false
  await page.getByRole('button', { name: '健康' }).click()
  await page.waitForTimeout(300)

  // 输入 WS URL 与 JWT，再手动连接
  await page.fill('#wsUrl', process.env.WS_URL || `ws://${host}:8080/ws`)
  await page.fill('#wsToken', token)
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '连接' }).click()

  // 轮询健康直到 connected:true（最多 ~6s）
  let ok = false
  for (let i = 0; i < 12; i++) {
    await page.getByRole('button', { name: '健康' }).click()
    const t = await page.locator('#health').textContent()
    if (t && t.includes('"connected": true')) { ok = true; break }
    await page.waitForTimeout(500)
  }
  expect(ok).toBeTruthy()

  // 订阅并等待消息
  await page.getByRole('button', { name: '订阅' }).click()
  await expect(page.locator('#out')).toContainText('ack: subscribe', { timeout: 5_000 })
  await expect(page.locator('#out')).toContainText('demo-msg-', { timeout: 15_000 })
  await page.waitForTimeout(2000)

  // 退订并确认停止新增
  await page.getByRole('button', { name: '退订' }).click()
  await expect(page.locator('#out')).toContainText('ack: unsubscribe', { timeout: 5_000 })
  const stable = await page.locator('#out').textContent()
  await page.waitForTimeout(8000)
  const stableAfter = await page.locator('#out').textContent()
  expect(stableAfter).toBe(stable)

  // 保留画面，保证总录像时长 ~30s
  await page.waitForTimeout(6000)
})
// @live Requires live gateway / manual flow against :8080
const LIVE = process.env.E2E_LIVE === '1'
test.skip(!LIVE, 'Requires live gateway (:8080)')
