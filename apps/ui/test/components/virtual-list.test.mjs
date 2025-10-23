// Unit tests for VirtualList component
// Tests batch processing, render budget, and virtualization

import { test } from 'node:test'
import { strict as assert } from 'node:assert'

test('VirtualList - render budget constraint', async (t) => {
  // Mock browser APIs
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16)
  global.cancelAnimationFrame = (id) => clearTimeout(id)
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }

  // Mock canvas and context
  const mockCanvas = {
    width: 800,
    height: 600,
    getContext: () => ({
      fillRect: () => {},
      fillText: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      drawImage: () => {},
      font: '',
      fillStyle: '',
      strokeStyle: '',
      textBaseline: ''
    }),
    style: {}
  }

  const mockContainer = {
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
    appendChild: () => {},
    innerHTML: ''
  }

  // Import component (dynamic import for ES modules)
  const { VirtualList } = await import('../../src/components/VirtualList.mjs')

  await t.test('initializes with correct dimensions', () => {
    const list = new VirtualList()

    // Mock DOM methods
    global.document = {
      createElement: (tag) => {
        if (tag === 'canvas') return mockCanvas
        return { style: {}, className: '', appendChild: () => {} }
      }
    }

    list.container = mockContainer
    list.setupCanvas()

    assert.equal(list.canvas.width, 800)
    assert.equal(list.canvas.height, 600)
    assert.equal(list.visibleRows, Math.ceil(600 / 30))
  })

  await t.test('respects render budget', () => {
    const list = new VirtualList()
    list.renderBudget = 8 // 8ms budget

    // Mock performance.now()
    let mockTime = 0
    global.performance = {
      now: () => mockTime
    }

    // Setup mock canvas
    global.document = {
      createElement: () => mockCanvas
    }
    list.container = mockContainer
    list.setupCanvas()

    // Add test data
    const testData = Array(100).fill(null).map((_, i) => ({
      id: i,
      value: `Item ${i}`
    }))
    list.data = testData

    // Mock render that exceeds budget
    const originalRenderRow = list.renderRow
    let rowsRendered = 0

    list.renderRow = (index, y) => {
      mockTime += 2 // Each row takes 2ms
      rowsRendered++
      originalRenderRow.call(list, index, y)
    }

    // Start render
    mockTime = 0
    list.render()

    // Should stop rendering when budget exceeded
    assert.ok(rowsRendered < testData.length)
    assert.ok(mockTime <= list.renderBudget + 2) // Allow one row over
  })

  await t.test('handles batch updates correctly', () => {
    const list = new VirtualList()
    list.batchInterval = 16

    // Track batch processing
    let batchProcessed = false
    let renderScheduled = false
    const originalProcessBatch = list.processBatch
    list.processBatch = function() {
      batchProcessed = true
      originalProcessBatch.call(this)
    }

    // Mock scheduleRender
    list.scheduleRender = function() {
      renderScheduled = true
    }

    // Add data updates - incremental mode
    const initialData = [{ id: 0, value: 'Initial' }]
    list.data = initialData
    const newData = [
      { id: 0, value: 'Initial' },
      { id: 1, value: 'New 1' },
      { id: 2, value: 'New 2' }
    ]
    list.updateData(newData)

    // Batch should be scheduled
    assert.ok(list.batchTimer !== null)

    // New items should be in pending updates
    assert.equal(list.pendingUpdates.length, 2)

    // Wait for batch processing
    return new Promise((resolve) => {
      setTimeout(() => {
        assert.ok(batchProcessed)
        // After batch processing, pendingUpdates should be empty
        assert.equal(list.pendingUpdates.length, 0)
        // Data should have all items
        assert.equal(list.data.length, 3)
        // Render should have been scheduled
        assert.ok(renderScheduled)
        resolve()
      }, 20)
    })
  })

  await t.test('virtualization only renders visible rows', () => {
    const list = new VirtualList()

    // Mock setup
    global.document = {
      createElement: () => mockCanvas
    }
    list.container = mockContainer
    list.setupCanvas()

    // Add more data than visible
    list.data = Array(1000).fill(null).map((_, i) => ({ id: i }))
    list.scrollTop = 300 // Scroll down
    list.visibleRows = 20

    // Track rendered rows
    const renderedIndices = []
    list.renderRow = (index) => {
      renderedIndices.push(index)
    }

    // Render
    list.render()

    // Should only render visible rows plus buffer
    const startRow = Math.floor(300 / 30)
    const endRow = startRow + 20 + 1

    assert.ok(renderedIndices.length <= 22) // visible + buffer
    assert.ok(renderedIndices[0] >= startRow)
    assert.ok(renderedIndices[renderedIndices.length - 1] <= endRow)
  })
})

test('VirtualList - memory management', async (t) => {
  const { VirtualList } = await import('../../src/components/VirtualList.mjs')

  await t.test('cleans up resources on destroy', () => {
    const list = new VirtualList()

    // Setup mocks
    let animationFrameCancelled = false
    let timerCleared = false
    let observerDisconnected = false
    let workerTerminated = false

    global.cancelAnimationFrame = () => { animationFrameCancelled = true }
    global.clearTimeout = () => { timerCleared = true }

    list.animationFrame = 123
    list.batchTimer = 456
    list.resizeObserver = {
      disconnect: () => { observerDisconnected = true }
    }
    list.worker = {
      terminate: () => { workerTerminated = true }
    }

    list.destroy()

    assert.ok(animationFrameCancelled)
    assert.ok(timerCleared)
    assert.ok(observerDisconnected)
    assert.ok(workerTerminated)
  })
})