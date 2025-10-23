import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'

let mockProc: ReturnType<typeof spawn> | null = null

test.beforeAll(async () => {
  mockProc = spawn('bash', ['-lc', 'node apps/ui/demo/metrics-mock.mjs'], { stdio: 'ignore' })
  // Give the mock a moment to start
  await new Promise(r => setTimeout(r, 500))
})

test.afterAll(async () => {
  try { mockProc?.kill() } catch {}
})

test('Ops Dashboard shows critical burn highlight with forceCrit', async ({ page, baseURL }) => {
  await page.goto('/demo/ops-dashboard.html?forceCrit=1')
  // Wait for metrics to render
  await expect(page.locator('#lat')).toHaveText(/ms/)
  await expect(page.locator('#slow')).toHaveText(/\d+/)
  await expect(page.locator('#reconnects')).toHaveText(/\d+/)
  await expect(page.locator('#storms')).toHaveText(/\d+/)

  // Burn element should reflect critical highlight
  const burn = page.locator('#burn')
  await expect(burn).toContainText(/x|∞/)
  await expect(burn).toHaveClass(/crit/)

  // Top‑N should be populated with 3 groups
  await expect(page.locator('#topn')).toHaveText(/xy\.md\.(1|2|3)/)
})

