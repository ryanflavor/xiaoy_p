import { test, expect } from '@playwright/test'

test('Ops Dashboard live via gateway metrics (gw=8080)', async ({ page }) => {
  await page.goto('/demo/ops-dashboard.html?gw=8080')
  // wait for first fetch & render
  await expect(page.locator('#lat')).toHaveText(/ms|--/, { timeout: 5000 })

  // allow one refresh cycle
  await page.waitForTimeout(2500)

  // expect rate and connections to be populated (latency may be unavailable in some setups)
  const rateText = await page.locator('#rate').textContent()
  expect(rateText && rateText.trim() !== '--').toBeTruthy()
  const connsText = await page.locator('#conns').textContent()
  expect(connsText && /\d+/.test(connsText)).toBeTruthy()

  // burn should show something like '0.00x / 0.00x' or 'crit' when data accumulates
  const burnText = await page.locator('#burn').textContent()
  expect(burnText && /(x|∞)/.test(burnText)).toBeTruthy()

  // Top-N should display at least one group token
  await expect(page.locator('#topn')).toHaveText(/xy\.md\./)
})
