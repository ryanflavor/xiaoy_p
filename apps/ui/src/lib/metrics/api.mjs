import { MetricsRegistry, MetricNames } from './metrics.mjs'

// Singleton registry for UI metrics
export const registry = new MetricsRegistry()

// Expose query and subscribe APIs for overlay consumption
export function querySnapshot () {
  return registry.snapshot()
}

/** Subscribe to periodic snapshots. Returns unsubscribe. */
export function subscribe (cb, intervalMs = 500) {
  let active = true
  const id = setInterval(() => { if (active) cb(querySnapshot()) }, intervalMs)
  return () => { active = false; clearInterval(id) }
}

// Helper signals for common metrics
export const uiFpsGauge = registry.gauge(MetricNames.ui_fps, () => 0)
export const e2eLatency = registry.latency(MetricNames.ui_e2e_latency_ms)
export const slowConsumers = registry.counter(MetricNames.ui_slow_consumers)

