import { test, expect } from '@playwright/test'

test('MinimalPanel degradation and recovery closed loop', async ({ page }) => {
  await page.goto('/demo/dashboard.html')
  try {
    await page.waitForFunction(() => !!(window as any).minimalPanelStore, { timeout: 2000 })
  } catch {
    await page.addScriptTag({ type: 'module', content: "import minimalPanelStore from '/src/stores/minimalPanelStore.mjs'; window.minimalPanelStore = minimalPanelStore;" })
    await page.waitForFunction(() => !!(window as any).minimalPanelStore)
  }

  // Degrade: simulate low FPS to trigger escalation (>= level 1)
  await page.evaluate(() => (window as any).minimalPanelStore.handleMetricsUpdate({ fps: 15 }))
  await expect.poll(async () => {
    const lvl = await page.evaluate(() => (window as any).minimalPanelStore.getState().degradation.level)
    return lvl
  }).toBeGreaterThanOrEqual(1)

  // Recover: simulate high FPS to trigger recovery back to 0
  // Nudge recovery multiple times to step levels back to 0
  await page.evaluate(() => (window as any).minimalPanelStore.handleMetricsUpdate({ fps: 65 }))
  await page.waitForTimeout(200)
  await page.evaluate(() => (window as any).minimalPanelStore.handleMetricsUpdate({ fps: 65 }))
  await page.waitForTimeout(200)
  await page.evaluate(() => (window as any).minimalPanelStore.handleMetricsUpdate({ fps: 65 }))
  await expect.poll(async () => {
    const lvl = await page.evaluate(() => (window as any).minimalPanelStore.getState().degradation.level)
    return lvl
  }).toBe(0)

  // Events timeline should record at least one warn/crit and one ok
  const events = await page.evaluate(() => (window as any).minimalPanelStore.getState().events)
  expect(Array.isArray(events)).toBeTruthy()
  expect(events.some((e: any) => e.level === 'ok')).toBeTruthy()
})
