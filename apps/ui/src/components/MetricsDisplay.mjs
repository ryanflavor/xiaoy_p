// MetricsDisplay component - Shows FPS, e2e latency, bandwidth metrics (AC2)
// Displays p50/p95/p99 and slow consumer count

import { minimalPanelStore } from '../stores/minimalPanelStore.mjs'

export class MetricsDisplay {
  constructor() {
    this.container = null
    this.unsubscribe = null
    this.elements = {}
    this.metricsHistory = {
      fps: [],
      latency: [],
      bandwidth: []
    }
    this.historySize = 60 // Keep last 60 samples
  }

  init(container) {
    this.container = container
    this.render()
    this.subscribeToStore()
    this.startMetricsCollection()
    return this
  }

  render() {
    this.container.innerHTML = `
      <div class="metrics-display">
        <div class="metric-item fps-metric">
          <span class="metric-label">FPS</span>
          <span id="fps-value" class="metric-value">--</span>
          <span id="fps-status" class="metric-status">●</span>
        </div>

        <div class="metric-item latency-metric">
          <span class="metric-label">端到端延迟</span>
          <div class="latency-values">
            <span class="latency-item">
              p50: <span id="latency-p50">--</span>ms
            </span>
            <span class="latency-item">
              p95: <span id="latency-p95">--</span>ms
            </span>
            <span class="latency-item">
              p99: <span id="latency-p99">--</span>ms
            </span>
          </div>
        </div>

        <div class="metric-item bandwidth-metric">
          <span class="metric-label">带宽</span>
          <span id="bandwidth-value" class="metric-value">-- KB/s</span>
        </div>

        <div class="metric-item slow-metric">
          <span class="metric-label">慢消费者</span>
          <span id="slow-count" class="metric-value">0</span>
          <span id="slow-warning" class="warning-icon" style="display: none;">⚠️</span>
        </div>

        <div class="metric-item reconnects-metric">
          <span class="metric-label">重连计数</span>
          <span id="reconnects-value" class="metric-value">0</span>
        </div>

        <div class="metric-item storms-metric">
          <span class="metric-label">订阅风暴</span>
          <span id="storms-value" class="metric-value">0</span>
        </div>

        <div class="metric-item frame-metric">
          <span class="metric-label">帧时</span>
          <span id="frame-time" class="metric-value">-- ms</span>
        </div>

        <style>
          .metrics-display {
            display: flex;
            gap: 24px;
            align-items: center;
            flex-wrap: wrap;
          }

          .metric-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 12px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e1e4e8;
          }

          .metric-label {
            font-size: 12px;
            color: #586069;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .metric-value {
            font-size: 14px;
            color: #24292e;
            font-weight: 600;
            font-family: ui-monospace, monospace;
          }

          .metric-status {
            font-size: 10px;
            line-height: 1;
          }

          .fps-metric .metric-status {
            color: #2ea043; /* Green by default */
          }

          .fps-metric.warning .metric-status {
            color: #f97316; /* Orange for warning */
          }

          .fps-metric.critical .metric-status {
            color: #cf222e; /* Red for critical */
          }

          .latency-values {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .latency-item {
            font-size: 13px;
            color: #24292e;
          }

          .latency-item span {
            font-weight: 600;
            font-family: ui-monospace, monospace;
          }

          .bandwidth-metric .metric-value {
            min-width: 80px;
            text-align: right;
          }

          .slow-metric {
            position: relative;
          }

          .warning-icon {
            color: #f97316;
            animation: pulse 1s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          .frame-metric {
            border-left: 2px solid #e1e4e8;
            padding-left: 16px;
          }

          .frame-metric.over-budget {
            border-left-color: #f97316;
          }

          .frame-metric.critical {
            border-left-color: #cf222e;
          }

          /* Responsive adjustments */
          @media (max-width: 1200px) {
            .metrics-display {
              font-size: 12px;
            }

            .latency-values {
              flex-direction: column;
              gap: 2px;
              align-items: flex-start;
            }
          }
        </style>
      </div>
    `

    // Cache element references
    this.elements = {
      fps: {
        value: this.container.querySelector('#fps-value'),
        status: this.container.querySelector('#fps-status'),
        container: this.container.querySelector('.fps-metric')
      },
      latency: {
        p50: this.container.querySelector('#latency-p50'),
        p95: this.container.querySelector('#latency-p95'),
        p99: this.container.querySelector('#latency-p99')
      },
      bandwidth: this.container.querySelector('#bandwidth-value'),
      slow: {
        count: this.container.querySelector('#slow-count'),
        warning: this.container.querySelector('#slow-warning')
      },
      reconnects: {
        value: this.container.querySelector('#reconnects-value')
      },
      storms: {
        value: this.container.querySelector('#storms-value')
      },
      frameTime: {
        value: this.container.querySelector('#frame-time'),
        container: this.container.querySelector('.frame-metric')
      }
    }
  }

  subscribeToStore() {
    this.unsubscribe = minimalPanelStore.subscribe((state) => {
      this.updateMetrics(state.metrics)
    })
  }

  startMetricsCollection() {
    // Collect and calculate metrics periodically
    setInterval(() => {
      this.collectMetrics()
    }, 500)

    // Fetch remote metrics from gateway
    this.fetchGatewayMetrics()
    setInterval(() => {
      this.fetchGatewayMetrics()
    }, 5000)
  }

  collectMetrics() {
    const state = minimalPanelStore.getState()
    const { metrics } = state

    // Add to history
    this.metricsHistory.fps.push(metrics.fps)
    if (this.metricsHistory.fps.length > this.historySize) {
      this.metricsHistory.fps.shift()
    }

    // Calculate bandwidth from data buffer changes
    const bandwidth = this.calculateBandwidth(state.dataBuffer)
    this.metricsHistory.bandwidth.push(bandwidth)
    if (this.metricsHistory.bandwidth.length > this.historySize) {
      this.metricsHistory.bandwidth.shift()
    }

    // Update store with calculated bandwidth
    minimalPanelStore.updateState({
      metrics: {
        ...metrics,
        bandwidth
      }
    })
  }

  calculateBandwidth(dataBuffer) {
    // Estimate bandwidth based on buffer size
    const totalSize = JSON.stringify(dataBuffer).length
    const sizeKB = totalSize / 1024
    return Math.round(sizeKB * 10) / 10 // KB/s approximation
  }

  async fetchGatewayMetrics() {
    try {
      // Try JSON endpoint first, fallback to parsing text metrics
      let response = await fetch('/metrics.json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }).catch(() => null)

      if (response?.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const metrics = await response.json()
          this.processGatewayMetrics(metrics)
          return
        }
      }

      // Fallback: try Prometheus text format on same-origin /metrics
      let textRes = await fetch('/metrics', { method: 'GET', headers: { 'Accept': 'text/plain' } }).catch(() => null)
      if (textRes?.ok) {
        const text = await textRes.text()
        const parsed = this.parsePrometheusText(text)
        this.processGatewayMetrics(parsed)
        return
      }

      // Fallback: try metrics-mock server on port 8081 for development
      response = await fetch('http://localhost:8081/metrics.json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }).catch(() => null)

      if (response?.ok) {
        const metrics = await response.json()
        this.processGatewayMetrics(metrics)
      }
    } catch (err) {
      // Silently handle errors - metrics are optional
      console.debug('Metrics fetch failed:', err.message)
    }
  }

  parsePrometheusText(text) {
    const lines = text.split(/\n+/)
    const data = {}
    for (const ln of lines) {
      if (!ln || ln.startsWith('#')) continue
      const [name, val] = ln.trim().split(/\s+/)
      const num = Number(val)
      if (!Number.isNaN(num)) data[name] = num
    }
    return {
      latency_p50: data['latency_p50'] ?? data['xy_latency_p50'],
      latency_p95: data['latency_p95'] ?? data['xy_latency_p95'],
      latency_p99: data['latency_p99'] ?? data['xy_latency_p99'],
      slow_consumers: data['slow_consumers'] ?? 0,
      ws_active: data['ws_active'] ?? 0,
      ws_msgs_rate: data['ws_msgs_rate'] ?? data['xy_ws_msgs_rate'],
      xy_nats_reconnects_total: data['xy_nats_reconnects_total'] ?? 0,
      xy_sub_storms_total: data['xy_sub_storms_total'] ?? 0,
    }
  }

  processGatewayMetrics(gatewayMetrics) {
    // Extract relevant metrics and update store
    const latency = {
      p50: gatewayMetrics?.latency_p50 || 0,
      p95: gatewayMetrics?.latency_p95 || 0,
      p99: gatewayMetrics?.latency_p99 || 0
    }

    const slowConsumers = gatewayMetrics?.slow_consumers || 0
    const reconnects = gatewayMetrics?.xy_nats_reconnects_total || 0
    const storms = gatewayMetrics?.xy_sub_storms_total || 0

    minimalPanelStore.updateState({
      metrics: {
        ...minimalPanelStore.getState().metrics,
        e2eLatency: latency,
        slowConsumers,
        reconnects,
        subStorms: storms
      }
    })
  }

  updateMetrics(metrics) {
    // Update FPS
    const fps = Math.round(metrics.fps)
    this.elements.fps.value.textContent = fps

    // Update FPS status indicator
    if (fps >= 60) {
      this.elements.fps.container.className = 'metric-item fps-metric'
      this.elements.fps.status.style.color = '#2ea043' // Green
    } else if (fps >= 30) {
      this.elements.fps.container.className = 'metric-item fps-metric warning'
      this.elements.fps.status.style.color = '#f97316' // Orange
    } else {
      this.elements.fps.container.className = 'metric-item fps-metric critical'
      this.elements.fps.status.style.color = '#cf222e' // Red
    }

    // Update latency
    this.elements.latency.p50.textContent = Math.round(metrics.e2eLatency.p50)
    this.elements.latency.p95.textContent = Math.round(metrics.e2eLatency.p95)
    this.elements.latency.p99.textContent = Math.round(metrics.e2eLatency.p99)

    // Color code latency values
    const p95 = metrics.e2eLatency.p95
    if (p95 > 180) {
      this.elements.latency.p95.style.color = '#cf222e' // Red if > P99 threshold
    } else if (p95 > 120) {
      this.elements.latency.p95.style.color = '#f97316' // Orange if > P95 threshold
    } else {
      this.elements.latency.p95.style.color = '#2ea043' // Green
    }

    const p99 = metrics.e2eLatency.p99
    if (p99 > 180) {
      this.elements.latency.p99.style.color = '#cf222e' // Red
    } else {
      this.elements.latency.p99.style.color = '#24292e' // Normal
    }

    // Update bandwidth
    const bandwidth = metrics.bandwidth
    if (bandwidth > 1024) {
      this.elements.bandwidth.textContent = `${(bandwidth / 1024).toFixed(1)} MB/s`
    } else {
      this.elements.bandwidth.textContent = `${bandwidth.toFixed(1)} KB/s`
    }

    // Update slow consumers
    this.elements.slow.count.textContent = metrics.slowConsumers
    this.elements.slow.warning.style.display = metrics.slowConsumers > 0 ? 'inline' : 'none'

    // Update reconnects and storms
    this.elements.reconnects.value.textContent = String(metrics.reconnects ?? 0)
    this.elements.storms.value.textContent = String(metrics.subStorms ?? 0)

    // Update frame time
    const frameTime = metrics.frameTime
    this.elements.frameTime.value.textContent = `${frameTime.toFixed(1)} ms`

    // Color code frame time
    if (frameTime > 16.67) {
      this.elements.frameTime.container.classList.add('critical')
    } else if (frameTime > 8) {
      this.elements.frameTime.container.classList.add('over-budget')
    } else {
      this.elements.frameTime.container.className = 'metric-item frame-metric'
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    this.container.innerHTML = ''
  }
}
