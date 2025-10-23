// Renderer Worker - Handles OffscreenCanvas rendering with batch processing
// Processes render commands from SharedWorker with 16-33ms batch intervals

class RendererWorker {
  constructor() {
    this.offscreenCanvas = null
    this.ctx = null
    this.renderQueue = []
    this.batchTimer = null
    this.batchInterval = 16 // Start with 16ms, adjust dynamically

    // Performance monitoring
    this.frameCount = 0
    this.lastFrameTime = 0
    this.renderBudget = 8 // ms per frame

    // Batch processing settings
    this.minBatchInterval = 16
    this.maxBatchInterval = 33

    this.init()
  }

  init() {
    // Listen for messages from main thread or SharedWorker
    self.addEventListener('message', (e) => this.handleMessage(e))

    // Start performance monitoring
    this.startPerformanceMonitor()
  }

  handleMessage(event) {
    const { type, data } = event.data

    switch (type) {
      case 'init-canvas':
        this.initCanvas(data)
        break

      case 'render':
        this.queueRenderCommand(data)
        break

      case 'batch-config':
        this.updateBatchConfig(data)
        break

      case 'clear':
        this.clearCanvas()
        break

      case 'get-stats':
        this.sendStats()
        break
    }
  }

  initCanvas(data) {
    const { canvas, width, height } = data

    if (canvas instanceof OffscreenCanvas) {
      this.offscreenCanvas = canvas
    } else {
      // Create new OffscreenCanvas if not provided
      this.offscreenCanvas = new OffscreenCanvas(width || 800, height || 600)
    }

    this.ctx = this.offscreenCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false
    })

    // Setup default styles
    this.ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    this.ctx.textBaseline = 'middle'

    self.postMessage({
      type: 'canvas-ready',
      width: this.offscreenCanvas.width,
      height: this.offscreenCanvas.height
    })
  }

  queueRenderCommand(command) {
    // Add to render queue
    this.renderQueue.push({
      ...command,
      timestamp: performance.now()
    })

    // Schedule batch processing
    this.scheduleBatch()
  }

  scheduleBatch() {
    if (this.batchTimer) return

    this.batchTimer = setTimeout(() => {
      this.processBatch()
      this.batchTimer = null
    }, this.batchInterval)
  }

  processBatch() {
    if (this.renderQueue.length === 0) return

    const startTime = performance.now()
    const commands = [...this.renderQueue]
    this.renderQueue = []

    // Process commands with budget constraint
    let processedCount = 0
    for (const command of commands) {
      // Check render budget
      if (performance.now() - startTime > this.renderBudget) {
        // Re-queue remaining commands
        this.renderQueue.push(...commands.slice(processedCount))
        console.log(`Render budget exceeded, re-queuing ${commands.length - processedCount} commands`)
        break
      }

      this.executeRenderCommand(command)
      processedCount++
    }

    // Adjust batch interval based on performance
    const renderTime = performance.now() - startTime
    this.adjustBatchInterval(renderTime, processedCount)

    // Send performance metrics
    self.postMessage({
      type: 'batch-complete',
      stats: {
        commandsProcessed: processedCount,
        renderTime: renderTime,
        queueLength: this.renderQueue.length,
        batchInterval: this.batchInterval
      }
    })

    // Schedule next batch if queue not empty
    if (this.renderQueue.length > 0) {
      this.scheduleBatch()
    }
  }

  executeRenderCommand(command) {
    const { action, params } = command

    switch (action) {
      case 'draw-list':
        this.drawList(params)
        break

      case 'draw-chart':
        this.drawChart(params)
        break

      case 'draw-text':
        this.drawText(params)
        break

      case 'draw-rect':
        this.drawRect(params)
        break

      case 'draw-line':
        this.drawLine(params)
        break

      case 'clear-region':
        this.clearRegion(params)
        break
    }
  }

  drawList(params) {
    const { items, startY, rowHeight, visibleRows } = params
    const ctx = this.ctx

    // Clear list area
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, startY, this.offscreenCanvas.width, rowHeight * visibleRows)

    // Draw rows
    items.forEach((item, index) => {
      const y = startY + index * rowHeight

      // Alternate row background
      if (index % 2 === 0) {
        ctx.fillStyle = '#f6f8fa'
        ctx.fillRect(0, y, this.offscreenCanvas.width, rowHeight)
      }

      // Row content
      ctx.fillStyle = '#24292e'
      ctx.fillText(item.text || '', 10, y + rowHeight / 2)
    })
  }

  drawChart(params) {
    const { points, bounds } = params
    if (!points || points.length < 2) return

    const ctx = this.ctx

    // Clear chart area
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)

    // Draw line
    ctx.strokeStyle = '#0969da'
    ctx.lineWidth = 2
    ctx.beginPath()

    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y)
      } else {
        ctx.lineTo(point.x, point.y)
      }
    })

    ctx.stroke()
  }

  drawText(params) {
    const { text, x, y, style = {} } = params
    const ctx = this.ctx

    // Apply style
    if (style.font) ctx.font = style.font
    if (style.fillStyle) ctx.fillStyle = style.fillStyle
    if (style.textAlign) ctx.textAlign = style.textAlign

    ctx.fillText(text, x, y)

    // Reset to defaults
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.fillStyle = '#24292e'
    ctx.textAlign = 'left'
  }

  drawRect(params) {
    const { x, y, width, height, fillStyle, strokeStyle } = params
    const ctx = this.ctx

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.fillRect(x, y, width, height)
    }

    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle
      ctx.strokeRect(x, y, width, height)
    }
  }

  drawLine(params) {
    const { x1, y1, x2, y2, strokeStyle = '#000', lineWidth = 1 } = params
    const ctx = this.ctx

    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  clearRegion(params) {
    const { x, y, width, height } = params
    this.ctx.clearRect(x, y, width, height)
  }

  clearCanvas() {
    if (!this.offscreenCanvas) return
    this.ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height)
  }

  updateBatchConfig(config) {
    const { minInterval, maxInterval, renderBudget } = config

    if (minInterval) this.minBatchInterval = minInterval
    if (maxInterval) this.maxBatchInterval = maxInterval
    if (renderBudget) this.renderBudget = renderBudget

    // Clamp current interval to new bounds
    this.batchInterval = Math.max(
      this.minBatchInterval,
      Math.min(this.maxBatchInterval, this.batchInterval)
    )
  }

  adjustBatchInterval(renderTime, commandCount) {
    // Dynamic adjustment based on performance
    if (renderTime > this.renderBudget * 1.5) {
      // Increase interval if taking too long
      this.batchInterval = Math.min(
        this.maxBatchInterval,
        this.batchInterval + 2
      )
    } else if (renderTime < this.renderBudget * 0.5 && commandCount > 10) {
      // Decrease interval if performing well with many commands
      this.batchInterval = Math.max(
        this.minBatchInterval,
        this.batchInterval - 1
      )
    }
  }

  startPerformanceMonitor() {
    setInterval(() => {
      const now = performance.now()
      const deltaTime = now - this.lastFrameTime
      const fps = deltaTime > 0 ? 1000 / deltaTime : 0

      this.lastFrameTime = now
      this.frameCount++

      // Send performance update
      if (this.frameCount % 60 === 0) {
        self.postMessage({
          type: 'performance-update',
          stats: {
            fps: Math.round(fps),
            queueLength: this.renderQueue.length,
            batchInterval: this.batchInterval,
            frameCount: this.frameCount
          }
        })
      }
    }, 1000)
  }

  sendStats() {
    self.postMessage({
      type: 'stats',
      data: {
        queueLength: this.renderQueue.length,
        batchInterval: this.batchInterval,
        frameCount: this.frameCount,
        canvasSize: this.offscreenCanvas
          ? { width: this.offscreenCanvas.width, height: this.offscreenCanvas.height }
          : null
      }
    })
  }
}

// Initialize renderer worker
const renderer = new RendererWorker()

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RendererWorker
}