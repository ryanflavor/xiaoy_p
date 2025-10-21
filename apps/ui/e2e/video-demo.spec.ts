import { test, expect } from '@playwright/test'

test.use({ video: 'on' })
test.describe('Video Demo (1920×1080)', () => {
  test('Open 4 tabs and broadcast messages (recorded)', async ({ context, page }) => {
    const base = '/demo/index.html'
    await page.goto(base)
    await page.waitForSelector('#broadcastText')
    await page.locator('#broadcastText').fill('video-demo-tab0')
    await page.locator('#btnBroadcast').click()
    const pages = [page]
    for (let i = 1; i < 4; i++) {
      const p = await context.newPage(); pages.push(p)
      await p.goto(base)
      await p.waitForSelector('#broadcastText')
      await p.locator('#broadcastText').fill('video-demo-tab'+i)
      await p.locator('#btnBroadcast').click()
    }
    // Short dwell so the recording captures activity
    await page.waitForTimeout(1500)
    for (const p of pages) await expect(p.locator('#out')).toContainText('video-demo-tab')
  })
})
