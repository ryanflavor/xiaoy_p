// VirtualList component with OffscreenCanvas rendering
// Implements row virtualization with batch patching and render budget ≤8ms

export class VirtualList {
  constructor() {
    this.container = null
    this.canvas = null
    this.offscreenCanvas = null
    this.ctx = null
    this.worker = null
    this.useWorkerRendering = true // Enable worker-based rendering

    // Virtualization state
    this.data = []
    this.rowHeight = 30
    this.visibleRows = 0
    this.scrollTop = 0
    this.totalHeight = 0

    // Rendering state
    this.renderBudget = 8 // ms per frame
    this.frameStart = 0
    this.pendingUpdates = []
    this.animationFrame = null

    // Batch processing
    this.batchTimer = null
    this.batchInterval = 16 // 16-33ms batch processing
  }

  init(container) {
    this.container = container
    this.setupCanvas()
    this.setupOffscreenRendering()
    this.setupScrollHandling()
    this.startRenderLoop()
    return this
  }

  setupCanvas() {
    // Create main canvas
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'virtual-list-canvas'

    // Setup dimensions
    const rect = this.container.getBoundingClientRect()
    this.canvas.width = rect.width
    this.canvas.height = rect.height
    this.visibleRows = Math.ceil(this.canvas.height / this.rowHeight)

    // Add styles
    this.canvas.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
      cursor: pointer;
    `

    this.container.innerHTML = ''
    this.container.appendChild(this.canvas)

    // Get 2D context for bitmap transfer
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    })
  }

  setupOffscreenRendering() {
    // Try to use worker-based rendering first
    if (this.useWorkerRendering && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
      try {
        // Create worker for rendering
        this.worker = new Worker('/src/worker/renderer/renderer-worker.mjs', { type: 'module' })

        // Create OffscreenCanvas and transfer to worker
        this.offscreenCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height)

        // Initialize worker with canvas
        this.worker.postMessage({
          type: 'init-canvas',
          data: {
            canvas: this.offscreenCanvas,
            width: this.canvas.width,
            height: this.canvas.height
          }
        }, [this.offscreenCanvas])

        // Handle worker messages
        this.worker.onmessage = (e) => {
          if (e.data.type === 'canvas-ready') {
            console.log('Renderer worker initialized')
          } else if (e.data.type === 'batch-complete') {
            // Transfer rendered bitmap to main canvas
            if (e.data.bitmap) {
              this.ctx.drawImage(e.data.bitmap, 0, 0)
            }
          }
        }

        this.useWorkerRendering = true
        return
      } catch (err) {
        console.warn('Failed to initialize worker rendering:', err)
        this.useWorkerRendering = false
      }
    }

    // Fallback to main thread rendering
    this.useWorkerRendering = false

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

    // Setup fonts and styles
    this.offscreenCtx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    this.offscreenCtx.textBaseline = 'middle'
  }

  setupScrollHandling() {
    // Create scroll container overlay
    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'virtual-scroll-container'
    scrollContainer.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 20px;
      height: 100%;
      overflow-y: auto;
      background: rgba(0,0,0,0.05);
    `

    // Create scroll content for proper scrollbar
    const scrollContent = document.createElement('div')
    scrollContent.style.height = `${this.totalHeight}px`
    scrollContainer.appendChild(scrollContent)

    scrollContainer.addEventListener('scroll', (e) => {
      this.scrollTop = e.target.scrollTop
      this.scheduleRender()
    })

    this.container.appendChild(scrollContainer)
    this.scrollContainer = scrollContainer
    this.scrollContent = scrollContent
  }

  updateData(newData) {
    // Determine if this is incremental or replacement update
    if (newData.length < this.data.length) {
      // Replacement mode - data was reset/cleared
      this.pendingUpdates = []
      this.data = newData
      this.scheduleRender()
    } else {
      // Incremental mode - only add new items
      const delta = newData.length - this.data.length
      if (delta > 0) {
        // Queue only the new items for batch processing
        this.pendingUpdates.push(...newData.slice(-delta))

        // Schedule batch processing
        if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => {
            this.processBatch()
            this.batchTimer = null
          }, this.batchInterval)
        }
      }
    }

    // Update total height
    this.totalHeight = newData.length * this.rowHeight
    if (this.scrollContent) {
      this.scrollContent.style.height = `${this.totalHeight}px`
    }
  }

  processBatch() {
    if (this.pendingUpdates.length === 0) return

    const batchSize = Math.min(100, this.pendingUpdates.length)
    const batch = this.pendingUpdates.splice(0, batchSize)

    // Apply updates to data (incremental append only)
    this.data.push(...batch)

    // Schedule render
    this.scheduleRender()
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

    // Lazy init offscreen canvas for test environments calling render() directly
    if (!this.offscreenCanvas && !this.offscreenCtx) {
      this.setupOffscreenRendering()
    }

    // Calculate visible range
    const startRow = Math.floor(this.scrollTop / this.rowHeight)
    const endRow = Math.min(startRow + this.visibleRows + 1, this.data.length)

    // If using worker rendering, send render command
    if (this.useWorkerRendering && this.worker) {
      const visibleData = this.data.slice(startRow, endRow).map((item, index) => ({
        text: typeof item === 'string' ? item : JSON.stringify(item).substring(0, 50),
        index: startRow + index
      }))

      this.worker.postMessage({
        type: 'render',
        data: {
          action: 'draw-list',
          params: {
            items: visibleData,
            startY: -(this.scrollTop % this.rowHeight),
            rowHeight: this.rowHeight,
            visibleRows: this.visibleRows
          }
        }
      })

      return // Worker will handle the rendering
    }

    // Fallback to main thread rendering
    // Clear offscreen canvas
    this.offscreenCtx.fillStyle = '#ffffff'
    this.offscreenCtx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height)

    // Render visible rows with budget constraint
    let rowsRendered = 0
    const offsetY = -(this.scrollTop % this.rowHeight)

    for (let i = startRow; i < endRow; i++) {
      // Check render budget
      if (performance.now() - startTime > this.renderBudget) {
        console.log(`Render budget exceeded after ${rowsRendered} rows`)
        break
      }

      this.renderRow(i, rowsRendered * this.rowHeight + offsetY)
      rowsRendered++
    }

    // Transfer to main canvas
    if (this.ctx && this.offscreenCanvas) {
      this.ctx.drawImage(this.offscreenCanvas, 0, 0)
    }

    // Log frame time
    const frameTime = performance.now() - startTime
    if (frameTime > this.renderBudget) {
      console.warn(`Frame time ${frameTime.toFixed(2)}ms exceeded budget of ${this.renderBudget}ms`)
    }
  }

  renderRow(index, y) {
    const item = this.data[index]
    if (!item) return

    const ctx = this.offscreenCtx
    const x = 10
    const rowY = y + this.rowHeight / 2

    // Alternate row background
    if (index % 2 === 0) {
      ctx.fillStyle = '#f6f8fa'
      ctx.fillRect(0, y, this.offscreenCanvas.width, this.rowHeight)
    }

    // Row border
    ctx.strokeStyle = '#e1e4e8'
    ctx.beginPath()
    ctx.moveTo(0, y + this.rowHeight)
    ctx.lineTo(this.offscreenCanvas.width, y + this.rowHeight)
    ctx.stroke()

    // Render row content
    ctx.fillStyle = '#24292e'

    // Index
    ctx.fillText(`#${index + 1}`, x, rowY)

    // Data (simplified for demo)
    const text = typeof item === 'string' ? item : JSON.stringify(item)
    ctx.fillText(text.substring(0, 50), x + 60, rowY)

    // Timestamp
    const timestamp = new Date().toLocaleTimeString()
    ctx.fillStyle = '#586069'
    ctx.fillText(timestamp, this.offscreenCanvas.width - 100, rowY)
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
        this.visibleRows = Math.ceil(this.canvas.height / this.rowHeight)
        this.render()
      })
      this.resizeObserver.observe(this.container)
    }
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    if (this.worker) {
      this.worker.terminate()
    }
    if (this.container) this.container.innerHTML = ''
  }
}
