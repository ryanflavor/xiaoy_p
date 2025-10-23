// Zustand-inspired store for minimal panel state management
// Manages subscriptions, metrics, and degradation state

import { sloConfig } from '../config/slo-config.mjs'
import { evaluateAndEmit } from '../lib/alerts.mjs'

class MinimalPanelStore {
  constructor() {
    this.state = {
      // Subscriptions state
      subscriptions: new Map(), // topic -> subscription data
      activeTopics: [],

      // Metrics state
      metrics: {
        fps: 0,
        e2eLatency: { p50: 0, p95: 0, p99: 0 },
        bandwidth: 0,
        slowConsumers: 0,
        frameTime: 0,
        renderBudget: 8, // ms per frame budget
      },

      // Degradation switches (AC3)
      degradation: {
        level: 0, // 0: normal, 1: sampling, 2: field trimming, 3: paused
        samplingRate: 1, // 1 = no sampling, 0.5 = 50% sampling
        fieldTrimming: false,
        isPaused: false,
        autoRecover: true,
        recoveryThreshold: 60, // FPS threshold for recovery
      },

      // Alert events timeline
      events: [], // { ts, level: 'ok'|'warn'|'crit', details }

      // UI state
      ui: {
        selectedView: 'list', // 'list' or 'chart'
        isConnected: false,
        connectionUrl: '',
        lastUpdate: Date.now(),
      },

      // Data buffers for rendering
      dataBuffer: {
        list: [],
        chart: [],
        maxBufferSize: 1000,
      }
    }

    this.listeners = new Set()
    this.worker = null
    this.port = null
  }

  // Initialize the store and connect to SharedWorker
  init() {
    this.connectToSharedWorker()
    this.startMetricsCollection()
  }

  // Connect to SharedWorker for data streaming
  connectToSharedWorker() {
    if (typeof SharedWorker !== 'function') {
      console.warn('SharedWorker not supported')
      return
    }

    try {
      this.worker = new SharedWorker('/src/worker/shared/shared-worker.mjs', { type: 'module' })
      this.port = this.worker.port
      this.port.start()

      this.port.onmessage = (e) => this.handleWorkerMessage(e.data)

      // Send initial connection
      this.port.postMessage({ kind: 'hello' })

      this.updateState({
        ui: { ...this.state.ui, isConnected: true }
      })
    } catch (err) {
      console.error('Failed to connect to SharedWorker:', err)
    }
  }

  // Handle messages from SharedWorker
  handleWorkerMessage(msg) {
    switch (msg.kind) {
      case 'data':
        this.handleDataMessage(msg.payload)
        break
      case 'metrics':
        this.handleMetricsUpdate(msg.payload)
        break
      case 'heartbeat':
        this.updateState({
          ui: { ...this.state.ui, lastUpdate: Date.now() }
        })
        break
    }
  }

  // Handle incoming data for list/chart rendering
  handleDataMessage(data) {
    const { list, chart } = this.state.dataBuffer

    // Apply degradation sampling if needed
    if (this.state.degradation.samplingRate < 1) {
      if (Math.random() > this.state.degradation.samplingRate) return
    }

    // Add to buffers with circular buffer behavior
    if (list.length >= this.state.dataBuffer.maxBufferSize) {
      list.shift()
    }
    list.push(data)

    if (chart.length >= this.state.dataBuffer.maxBufferSize) {
      chart.shift()
    }
    chart.push({
      timestamp: Date.now(),
      value: data.value || Math.random() * 100, // Placeholder for chart data
    })

    this.updateState({
      dataBuffer: { ...this.state.dataBuffer, list, chart }
    })
  }

  // Handle metrics updates
  handleMetricsUpdate(metrics) {
    this.updateState({
      metrics: { ...this.state.metrics, ...metrics }
    })

    // Auto-adjust degradation based on performance
    if (this.state.degradation.autoRecover) {
      this.adjustDegradation(metrics.fps)
    }

    // Evaluate against SLO thresholds and trigger degradation hooks
    try {
      const snapshot = {
        fps: this.state.metrics.fps,
        e2eLatency: this.state.metrics.e2eLatency,
        slowConsumers: this.state.metrics.slowConsumers,
      }
      const res = evaluateAndEmit(snapshot, sloConfig, {
        onWarn: (r) => {
          // Ensure at least level 1 on warnings
          if (this.state.degradation.level < 1) this.setDegradationLevel(1)
          this.recordEvent('warn', r.details)
        },
        onCrit: (r) => {
          // Jump to level 2 on critical; level 3 left to auto path if FPS collapses
          if (this.state.degradation.level < 2) this.setDegradationLevel(2)
          this.recordEvent('crit', r.details)
        },
        recorder: ({ ts, level, details }) => this.recordEvent(level, details, ts),
      })
      if (res.level === 'ok') this.recordEvent('ok', res.details)
    } catch (e) {
      // Non-fatal
      console.debug('alerts evaluation skipped:', e?.message)
    }
  }

  recordEvent(level, details = {}, ts = Date.now()) {
    const events = this.state.events.slice(-199)
    events.push({ ts, level, details })
    this.updateState({ events })
  }

  // Start collecting local metrics
  startMetricsCollection() {
    setInterval(() => {
      // Collect FPS from global meter
      const fps = window.fpsMeter?.fps() || 0

      // Calculate frame time
      const frameTime = fps > 0 ? 1000 / fps : 0

      this.updateState({
        metrics: {
          ...this.state.metrics,
          fps,
          frameTime: Math.round(frameTime * 100) / 100
        }
      })
    }, 250)
  }

  // Adjust degradation level based on performance (AC3)
  adjustDegradation(fps) {
    const { degradation } = this.state
    let newLevel = degradation.level

    if (fps < 30 && degradation.level < 3) {
      // Degrade further
      newLevel = Math.min(degradation.level + 1, 3)
    } else if (fps > degradation.recoveryThreshold && degradation.level > 0) {
      // Recover
      newLevel = Math.max(degradation.level - 1, 0)
    }

    if (newLevel !== degradation.level) {
      this.setDegradationLevel(newLevel)
    }
  }

  // Set degradation level (AC3)
  setDegradationLevel(level) {
    const config = {
      0: { samplingRate: 1, fieldTrimming: false, isPaused: false },
      1: { samplingRate: 0.5, fieldTrimming: false, isPaused: false },
      2: { samplingRate: 0.25, fieldTrimming: true, isPaused: false },
      3: { samplingRate: 0, fieldTrimming: true, isPaused: true },
    }

    const newDegradation = {
      ...this.state.degradation,
      level,
      ...config[level]
    }

    this.updateState({ degradation: newDegradation })

    // Notify worker about degradation
    this.port?.postMessage({
      kind: 'degradation',
      level,
      config: config[level]
    })
  }

  // Subscribe to a topic
  subscribeTopic(topic) {
    if (!this.port) return

    this.port.postMessage({ kind: 'subscribe', topic })

    const subscriptions = new Map(this.state.subscriptions)
    subscriptions.set(topic, { subscribedAt: Date.now(), messageCount: 0 })

    this.updateState({
      subscriptions,
      activeTopics: Array.from(subscriptions.keys())
    })
  }

  // Unsubscribe from a topic
  unsubscribe(topic) {
    if (!this.port) return

    this.port.postMessage({ kind: 'unsubscribe', topic })

    const subscriptions = new Map(this.state.subscriptions)
    subscriptions.delete(topic)

    this.updateState({
      subscriptions,
      activeTopics: Array.from(subscriptions.keys())
    })
  }

  // Toggle degradation switch manually
  toggleDegradation(enabled) {
    this.updateState({
      degradation: {
        ...this.state.degradation,
        autoRecover: !enabled,
        level: enabled ? 1 : 0
      }
    })

    if (enabled) {
      this.setDegradationLevel(1)
    } else {
      this.setDegradationLevel(0)
    }
  }

  // Update state and notify listeners
  updateState(partial) {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.state)

    return () => {
      this.listeners.delete(listener)
    }
  }

  // Notify all listeners
  notify() {
    this.listeners.forEach(listener => listener(this.state))
  }

  // Get current state
  getState() {
    return this.state
  }

  // Cleanup
  destroy() {
    this.port?.close()
    this.listeners.clear()
  }
}

// Export singleton instance
export const minimalPanelStore = new MinimalPanelStore()
export default minimalPanelStore
