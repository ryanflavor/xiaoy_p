// MinimalPanel component - Main dashboard with list/chart views
import { minimalPanelStore } from '../../stores/minimalPanelStore.mjs'
import { VirtualList } from '../../components/VirtualList.mjs'
import { ChartCanvas } from '../../components/ChartCanvas.mjs'
import { DegradationControls } from '../../components/DegradationControls.mjs'
import { MetricsDisplay } from '../../components/MetricsDisplay.mjs'

class MinimalPanelView {
  constructor() {
    this.rootElement = null
    this.unsubscribe = null
    this.virtualList = null
    this.chartCanvas = null
    this.currentView = 'list'
  }

  init(rootElement) {
    this.rootElement = rootElement
    this.render()
    this.setupEventListeners()
    this.subscribeToStore()
    return this
  }

  render() {
    this.rootElement.innerHTML = `
      <div class="minimal-panel">
        <header class="panel-header">
          <h1>最小可见面板</h1>
          <div class="view-switcher">
            <button class="view-btn" data-view="list">列表视图</button>
            <button class="view-btn" data-view="chart">图表视图</button>
          </div>
        </header>

        <div class="panel-controls">
          <div class="subscription-controls">
            <input type="text" id="topic-input" placeholder="输入订阅主题 (e.g., xy.md.tick.demo)" />
            <button id="subscribe-btn">订阅</button>
            <button id="unsubscribe-btn">退订</button>
          </div>
          <div id="degradation-controls"></div>
        </div>

        <div class="metrics-bar" id="metrics-display"></div>

        <main class="panel-content">
          <div id="view-container" class="view-container">
            <!-- Virtual list or chart will be rendered here -->
          </div>
        </main>

        <style>
          .minimal-panel {
            display: flex;
            flex-direction: column;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            background: #f6f8fa;
            border-bottom: 1px solid #d1d5da;
          }

          .panel-header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
          }

          .view-switcher {
            display: flex;
            gap: 8px;
          }

          .view-btn {
            padding: 8px 16px;
            background: white;
            border: 1px solid #d1d5da;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .view-btn:hover {
            background: #f0f0f0;
          }

          .view-btn.active {
            background: #0969da;
            color: white;
            border-color: #0969da;
          }

          .panel-controls {
            padding: 16px 24px;
            background: white;
            border-bottom: 1px solid #d1d5da;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .subscription-controls {
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .subscription-controls input {
            padding: 8px 12px;
            border: 1px solid #d1d5da;
            border-radius: 6px;
            width: 300px;
          }

          .subscription-controls button {
            padding: 8px 16px;
            background: #0969da;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
          }

          .subscription-controls button:hover {
            background: #0860ca;
          }

          .metrics-bar {
            padding: 12px 24px;
            background: #f6f8fa;
            border-bottom: 1px solid #d1d5da;
            display: flex;
            gap: 24px;
            align-items: center;
            font-size: 14px;
          }

          .panel-content {
            flex: 1;
            overflow: hidden;
            background: white;
            position: relative;
          }

          .view-container {
            width: 100%;
            height: 100%;
            position: relative;
          }
        </style>
      </div>
    `

    // Initialize sub-components
    this.initializeSubComponents()
  }

  initializeSubComponents() {
    // Initialize degradation controls
    const degradationContainer = document.getElementById('degradation-controls')
    new DegradationControls().init(degradationContainer)

    // Initialize metrics display
    const metricsContainer = document.getElementById('metrics-display')
    new MetricsDisplay().init(metricsContainer)

    // Initialize view based on current selection
    this.switchView(this.currentView)
  }

  setupEventListeners() {
    // View switcher
    this.rootElement.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view
        this.switchView(view)

        // Update active button
        this.rootElement.querySelectorAll('.view-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.view === view)
        })
      })
    })

    // Set initial active button
    this.rootElement.querySelector(`[data-view="${this.currentView}"]`).classList.add('active')

    // Subscription controls
    const topicInput = this.rootElement.querySelector('#topic-input')
    const subscribeBtn = this.rootElement.querySelector('#subscribe-btn')
    const unsubscribeBtn = this.rootElement.querySelector('#unsubscribe-btn')

    subscribeBtn.addEventListener('click', () => {
      const topic = topicInput.value.trim()
      if (topic) {
        minimalPanelStore.subscribeTopic(topic)
      }
    })

    unsubscribeBtn.addEventListener('click', () => {
      const topic = topicInput.value.trim()
      if (topic) {
        minimalPanelStore.unsubscribe(topic)
      }
    })
  }

  switchView(view) {
    this.currentView = view
    const container = this.rootElement.querySelector('#view-container')

    // Cleanup previous view
    if (this.virtualList) {
      this.virtualList.destroy()
      this.virtualList = null
    }
    if (this.chartCanvas) {
      this.chartCanvas.destroy()
      this.chartCanvas = null
    }

    // Initialize new view
    if (view === 'list') {
      this.virtualList = new VirtualList()
      this.virtualList.init(container)
    } else if (view === 'chart') {
      this.chartCanvas = new ChartCanvas()
      this.chartCanvas.init(container)
    }
  }

  subscribeToStore() {
    this.unsubscribe = minimalPanelStore.subscribe((state) => {
      // Update components with new state
      if (this.virtualList) {
        this.virtualList.updateData(state.dataBuffer.list)
      }
      if (this.chartCanvas) {
        this.chartCanvas.updateData(state.dataBuffer.chart)
      }
    })
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    if (this.virtualList) {
      this.virtualList.destroy()
    }
    if (this.chartCanvas) {
      this.chartCanvas.destroy()
    }
  }
}

// Factory function for router
export function MinimalPanel(rootElement) {
  const panel = new MinimalPanelView()
  panel.init(rootElement)
  return panel
}
