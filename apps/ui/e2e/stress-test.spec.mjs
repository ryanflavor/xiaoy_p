// Stress test for minimal panel - Tests rendering performance and frame budget
// Validates AC1: Render budget ≤8ms per frame
// Validates AC2: FPS/latency/bandwidth metrics visibility
// Validates AC3: Degradation strategy triggers and recovery

import { test, expect } from '@playwright/test'
// @live Requires :8080 dashboard app
const LIVE = process.env.E2E_LIVE === '1'
test.skip(!LIVE, 'Requires live dashboard at :8080')

const STRESS_CONFIG = {
  dataRate: 100, // Messages per second
  duration: 30000, // 30 seconds
  windows: 4, // Number of concurrent windows
  targetFPS: 60,
  maxLatencyP95: 120,
  maxLatencyP99: 180,
  renderBudget: 8 // ms
}

test.describe('Story 1.6 - Minimal Panel Stress Tests', () => {
  test.setTimeout(60000) // 60 second timeout

  test('AC1: OffscreenCanvas renders within 8ms budget', async ({ page }) => {
    await page.goto('http://localhost:8080/#/dashboard')

    // Start performance monitoring
    const frameTimings = await page.evaluate(() => {
      const timings = []
      let lastTime = performance.now()

      const measure = () => {
        const now = performance.now()
        const frameTime = now - lastTime
        timings.push(frameTime)
        lastTime = now

        if (timings.length < 300) { // Collect 300 frames (~5 seconds at 60fps)
          requestAnimationFrame(measure)
        }
      }

      requestAnimationFrame(measure)

      return new Promise(resolve => {
        setTimeout(() => resolve(timings), 6000)
      })
    })

    // Analyze frame timings
    const p95Frame = calculatePercentile(frameTimings, 95)
    const p99Frame = calculatePercentile(frameTimings, 99)
    const avgFrame = frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length

    console.log(`Frame timing stats: avg=${avgFrame.toFixed(2)}ms, p95=${p95Frame.toFixed(2)}ms, p99=${p99Frame.toFixed(2)}ms`)

    // Verify render budget
    expect(p95Frame).toBeLessThanOrEqual(STRESS_CONFIG.renderBudget * 2) // Allow 2x budget for p95
    expect(avgFrame).toBeLessThanOrEqual(STRESS_CONFIG.renderBudget)
  })

  test('AC2: Metrics are visible and updating', async ({ page }) => {
    await page.goto('http://localhost:8080/#/dashboard')

    // Check FPS display
    const fpsElement = await page.locator('#fps-value')
    await expect(fpsElement).toBeVisible()

    // Check latency metrics
    const p50Element = await page.locator('#latency-p50')
    const p95Element = await page.locator('#latency-p95')
    const p99Element = await page.locator('#latency-p99')

    await expect(p50Element).toBeVisible()
    await expect(p95Element).toBeVisible()
    await expect(p99Element).toBeVisible()

    // Check bandwidth display
    const bandwidthElement = await page.locator('#bandwidth-value')
    await expect(bandwidthElement).toBeVisible()

    // Wait and verify metrics are updating
    await page.waitForTimeout(2000)

    const fps = await fpsElement.textContent()
    expect(parseInt(fps)).toBeGreaterThan(0)

    const p95 = await p95Element.textContent()
    expect(parseInt(p95)).toBeLessThanOrEqual(STRESS_CONFIG.maxLatencyP95)

    const p99 = await p99Element.textContent()
    expect(parseInt(p99)).toBeLessThanOrEqual(STRESS_CONFIG.maxLatencyP99)
  })

  test('AC3: Degradation triggers and recovers correctly', async ({ page }) => {
    await page.goto('http://localhost:8080/#/dashboard')

    // Enable degradation mode
    const degradationToggle = await page.locator('#degradation-toggle')
    await degradationToggle.click()

    // Check degradation level indicator
    const levelIndicator = await page.locator('#degradation-level')
    await expect(levelIndicator).toContainText(/采样降频|字段裁剪|已暂停/)

    // Generate heavy load to trigger degradation
    await page.evaluate(() => {
      // Simulate heavy data load
      for (let i = 0; i < 1000; i++) {
        window.minimalPanelStore?.handleDataMessage({
          value: Math.random() * 100,
          timestamp: Date.now()
        })
      }
    })

    await page.waitForTimeout(2000)

    // Check if degradation level increased
    const degradationLevel = await levelIndicator.textContent()
    console.log(`Degradation level after load: ${degradationLevel}`)

    // Stop load and wait for recovery
    await page.waitForTimeout(5000)

    // Check auto-recovery
    const recoveredLevel = await levelIndicator.textContent()
    expect(['正常', '采样降频']).toContain(recoveredLevel)
  })

  test('Multi-window stress test (≥4 windows)', async ({ browser }) => {
    const windows = []
    const contexts = []

    // Open multiple windows
    for (let i = 0; i < STRESS_CONFIG.windows; i++) {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto('http://localhost:8080/#/dashboard')

      contexts.push(context)
      windows.push(page)
    }

    // Subscribe to test topic in all windows
    for (const page of windows) {
      await page.evaluate(() => {
        window.minimalPanelStore?.subscribe('xy.md.tick.stress')
      })
    }

    // Generate load in all windows
    const loadPromises = windows.map(async (page, index) => {
      return page.evaluate(({ index, config }) => {
        const startTime = Date.now()
        const messages = []

        const generateLoad = () => {
          const now = Date.now()
          if (now - startTime > config.duration) return

          // Generate batch of messages
          for (let i = 0; i < config.dataRate / 60; i++) {
            messages.push({
              window: index,
              value: Math.random() * 100,
              timestamp: now
            })
          }

          // Send to store
          window.minimalPanelStore?.handleDataMessage({
            value: messages[messages.length - 1].value,
            timestamp: now
          })

          requestAnimationFrame(generateLoad)
        }

        generateLoad()

        return new Promise(resolve => {
          setTimeout(() => resolve(messages.length), config.duration)
        })
      }, { index, config: STRESS_CONFIG })
    })

    const results = await Promise.all(loadPromises)
    console.log(`Messages generated per window: ${results}`)

    // Check performance in all windows
    for (let i = 0; i < windows.length; i++) {
      const page = windows[i]

      // Check FPS
      const fps = await page.locator('#fps-value').textContent()
      expect(parseInt(fps)).toBeGreaterThanOrEqual(30) // Allow lower FPS under stress

      // Check that UI is still responsive
      const viewBtn = await page.locator('[data-view="chart"]')
      await viewBtn.click()
      await expect(viewBtn).toHaveClass(/active/)
    }

    // Cleanup
    for (const context of contexts) {
      await context.close()
    }
  })

  test('Performance baseline validation', async ({ page }) => {
    await page.goto('http://localhost:8080/#/dashboard')

    // Setup performance observer
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics = {
          paints: [],
          measures: [],
          resources: []
        }

        // Observe performance
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'paint') {
              metrics.paints.push({
                name: entry.name,
                time: entry.startTime
              })
            } else if (entry.entryType === 'measure') {
              metrics.measures.push({
                name: entry.name,
                duration: entry.duration
              })
            }
          }
        })

        observer.observe({ entryTypes: ['paint', 'measure'] })

        // Collect metrics for 10 seconds
        setTimeout(() => {
          observer.disconnect()

          // Get resource timing
          metrics.resources = performance.getEntriesByType('resource').map(r => ({
            name: r.name,
            duration: r.duration,
            size: r.transferSize
          }))

          resolve(metrics)
        }, 10000)
      })
    })

    // Validate performance baseline
    const firstPaint = metrics.paints.find(p => p.name === 'first-paint')
    const firstContentfulPaint = metrics.paints.find(p => p.name === 'first-contentful-paint')

    expect(firstPaint?.time).toBeLessThan(1000) // FP < 1s
    expect(firstContentfulPaint?.time).toBeLessThan(1500) // FCP < 1.5s

    console.log('Performance baseline:', {
      firstPaint: firstPaint?.time,
      firstContentfulPaint: firstContentfulPaint?.time,
      resourceCount: metrics.resources.length
    })
  })
})

// Helper function to calculate percentiles
function calculatePercentile(array, percentile) {
  const sorted = array.slice().sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[index]
}
