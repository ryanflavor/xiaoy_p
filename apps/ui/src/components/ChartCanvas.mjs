// ChartCanvas component with OffscreenCanvas rendering
// Implements simple chart with data point throttling and sampling strategy

export class ChartCanvas {
  constructor() {
    this.container = null
    this.canvas = null
    this.offscreenCanvas = null
    this.ctx = null

    // Chart data
    this.data = []
    this.maxDataPoints = 500 // Maximum points to display
    this.samplingRate = 1 // Dynamic sampling rate

    // Chart dimensions
    this.chartPadding = { top: 20, right: 50, bottom: 40, left: 60 }
    this.chartWidth = 0
    this.chartHeight = 0

    // Rendering state
    this.renderBudget = 8 // ms per frame
    this.animationFrame = null

    // Data throttling
    this.lastDataUpdate = 0
    this.throttleInterval = 50 // Minimum ms between data updates

    // Chart range
    this.yMin = 0
    this.yMax = 100
    this.xRange = 60000 // Show last 60 seconds
  }

  init(container) {
    this.container = container
    this.setupCanvas()
    this.setupOffscreenRendering()
    this.startRenderLoop()
    return this
  }

  setupCanvas() {
    // Create main canvas
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'chart-canvas'

    // Setup dimensions
    const rect = this.container.getBoundingClientRect()
    this.canvas.width = rect.width
    this.canvas.height = rect.height
    this.updateChartDimensions()

    // Add styles
    this.canvas.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
    `

    this.container.innerHTML = ''
    this.container.appendChild(this.canvas)

    // Get 2D context
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    })
  }

  setupOffscreenRendering() {
    // Create OffscreenCanvas for rendering
    if (typeof OffscreenCanvas !== 'undefined') {
      this.offscreenCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height)
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true
      })
    } else {
      // Fallback to regular canvas
      this.offscreenCanvas = document.createElement('canvas')
      this.offscreenCanvas.width = this.canvas.width
      this.offscreenCanvas.height = this.canvas.height
      this.offscreenCtx = this.offscreenCanvas.getContext('2d')
    }

    // Setup styles
    this.offscreenCtx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    this.offscreenCtx.textBaseline = 'middle'
    this.offscreenCtx.lineWidth = 2
  }

  updateChartDimensions() {
    this.chartWidth = this.canvas.width - this.chartPadding.left - this.chartPadding.right
    this.chartHeight = this.canvas.height - this.chartPadding.top - this.chartPadding.bottom
  }

  updateData(newData) {
    const now = Date.now()

    // Throttle data updates
    if (now - this.lastDataUpdate < this.throttleInterval) {
      return
    }
    this.lastDataUpdate = now

    // Apply sampling strategy based on data rate
    const dataRate = newData.length / this.throttleInterval
    if (dataRate > 10) {
      // High data rate - increase sampling
      this.samplingRate = Math.min(Math.floor(dataRate / 10), 10)
    } else {
      this.samplingRate = 1
    }

    // Sample and add new data points
    for (let i = 0; i < newData.length; i += this.samplingRate) {
      const point = newData[i]
      if (point) {
        this.data.push({
          timestamp: point.timestamp || Date.now(),
          value: point.value || 0
        })
      }
    }

    // Trim old data points (keep only recent window)
    const cutoffTime = now - this.xRange
    while (this.data.length > 0 && this.data[0].timestamp < cutoffTime) {
      this.data.shift()
    }

    // Limit maximum data points
    if (this.data.length > this.maxDataPoints) {
      // Downsample by taking every nth point
      const downsampleRate = Math.ceil(this.data.length / this.maxDataPoints)
      this.data = this.data.filter((_, index) => index % downsampleRate === 0)
    }

    // Update Y range dynamically
    if (this.data.length > 0) {
      const values = this.data.map(d => d.value)
      this.yMin = Math.min(...values) * 0.9
      this.yMax = Math.max(...values) * 1.1
    }

    // Schedule render only if a drawing context is available (avoid async noise in tests)
    if (this.ctx || (this.offscreenCanvas && this.offscreenCtx)) {
      this.scheduleRender()
    }
  }

  scheduleRender() {
    if (!this.animationFrame) {
      this.animationFrame = requestAnimationFrame(() => {
        this.render()
        this.animationFrame = null
      })
    }
  }

  render() {
    const startTime = performance.now()
    // Lazy init offscreen in case init() was bypassed in tests
    if (!this.offscreenCanvas && !this.offscreenCtx) {
      this.setupOffscreenRendering()
    }
    const ctx = this.offscreenCtx

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    const clearW = this.offscreenCanvas?.width ?? this.canvas?.width ?? 0
    const clearH = this.offscreenCanvas?.height ?? this.canvas?.height ?? 0
    ctx.fillRect(0, 0, clearW, clearH)

    // Draw axes
    this.drawAxes()

    // Draw grid
    this.drawGrid()

    // Draw chart line with budget constraint
    this.drawChart(startTime)

    // Draw labels
    this.drawLabels()

    // Transfer to main canvas if available
    if (this.ctx && this.offscreenCanvas) {
      this.ctx.drawImage(this.offscreenCanvas, 0, 0)
    }

    // Log frame time
    const frameTime = performance.now() - startTime
    if (frameTime > this.renderBudget) {
      console.warn(`Chart frame time ${frameTime.toFixed(2)}ms exceeded budget of ${this.renderBudget}ms`)
    }
  }

  drawAxes() {
    const ctx = this.offscreenCtx
    ctx.strokeStyle = '#d1d5da'
    ctx.lineWidth = 1

    // X-axis
    ctx.beginPath()
    ctx.moveTo(this.chartPadding.left, this.chartPadding.top + this.chartHeight)
    ctx.lineTo(this.chartPadding.left + this.chartWidth, this.chartPadding.top + this.chartHeight)
    ctx.stroke()

    // Y-axis
    ctx.beginPath()
    ctx.moveTo(this.chartPadding.left, this.chartPadding.top)
    ctx.lineTo(this.chartPadding.left, this.chartPadding.top + this.chartHeight)
    ctx.stroke()
  }

  drawGrid() {
    const ctx = this.offscreenCtx
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 0.5

    // Horizontal grid lines
    const ySteps = 5
    for (let i = 0; i <= ySteps; i++) {
      const y = this.chartPadding.top + (i * this.chartHeight / ySteps)
      ctx.beginPath()
      ctx.moveTo(this.chartPadding.left, y)
      ctx.lineTo(this.chartPadding.left + this.chartWidth, y)
      ctx.stroke()
    }

    // Vertical grid lines
    const xSteps = 6
    for (let i = 0; i <= xSteps; i++) {
      const x = this.chartPadding.left + (i * this.chartWidth / xSteps)
      ctx.beginPath()
      ctx.moveTo(x, this.chartPadding.top)
      ctx.lineTo(x, this.chartPadding.top + this.chartHeight)
      ctx.stroke()
    }
  }

  drawChart(startTime) {
    if (this.data.length < 2) return

    const ctx = this.offscreenCtx
    const now = Date.now()

    // Setup line style
    ctx.strokeStyle = '#0969da'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    // Begin path
    ctx.beginPath()

    // Draw line with incremental rendering
    let pointsDrawn = 0
    for (let i = 0; i < this.data.length; i++) {
      // Check render budget every 100 points
      if (i % 100 === 0 && performance.now() - startTime > this.renderBudget * 0.7) {
        console.log(`Chart render budget limit reached after ${pointsDrawn} points`)
        break
      }

      const point = this.data[i]
      const x = this.mapX(point.timestamp, now)
      const y = this.mapY(point.value)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
      pointsDrawn++
    }

    ctx.stroke()

    // Draw data points (only last few for performance)
    const pointsToShow = Math.min(20, this.data.length)
    ctx.fillStyle = '#0969da'
    for (let i = this.data.length - pointsToShow; i < this.data.length; i++) {
      const point = this.data[i]
      const x = this.mapX(point.timestamp, now)
      const y = this.mapY(point.value)

      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  drawLabels() {
    const ctx = this.offscreenCtx
    ctx.fillStyle = '#586069'
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

    // Y-axis labels
    const ySteps = 5
    for (let i = 0; i <= ySteps; i++) {
      const value = this.yMin + (this.yMax - this.yMin) * (1 - i / ySteps)
      const y = this.chartPadding.top + (i * this.chartHeight / ySteps)
      ctx.textAlign = 'right'
      ctx.fillText(value.toFixed(1), this.chartPadding.left - 5, y)
    }

    // X-axis labels (time)
    const xSteps = 6
    const now = Date.now()
    ctx.textAlign = 'center'
    for (let i = 0; i <= xSteps; i++) {
      const time = now - (xSteps - i) * (this.xRange / xSteps)
      const x = this.chartPadding.left + (i * this.chartWidth / xSteps)
      // Be resilient if Date constructor is mocked in test env
      let label = String(Math.round((time % 60000) / 1000))
      try {
        const d = new Date(time)
        if (d && typeof d.toLocaleTimeString === 'function') {
          label = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      } catch {}
      ctx.fillText(label, x, this.chartPadding.top + this.chartHeight + 20)
    }

    // Chart title
    ctx.fillStyle = '#24292e'
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('实时数据图表', this.chartPadding.left, 15)

    // Data info
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`数据点: ${this.data.length} | 采样率: 1/${this.samplingRate}`,
                 this.canvas.width - this.chartPadding.right, 15)
  }

  mapX(timestamp, now) {
    const age = now - timestamp
    const ratio = 1 - (age / this.xRange)
    return this.chartPadding.left + ratio * this.chartWidth
  }

  mapY(value) {
    const ratio = (value - this.yMin) / (this.yMax - this.yMin)
    return this.chartPadding.top + (1 - ratio) * this.chartHeight
  }

  startRenderLoop() {
    // Initial render
    this.render()

    // Setup resize observer
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        const rect = this.container.getBoundingClientRect()
        this.canvas.width = rect.width
        this.canvas.height = rect.height
        this.offscreenCanvas.width = rect.width
        this.offscreenCanvas.height = rect.height
        this.updateChartDimensions()
        this.render()
      })
      this.resizeObserver.observe(this.container)
    }
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    this.container.innerHTML = ''
  }
}
