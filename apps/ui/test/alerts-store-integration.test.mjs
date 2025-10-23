import test from 'node:test'
import assert from 'node:assert/strict'
import minimalPanelStore from '../src/stores/minimalPanelStore.mjs'

test('alerts integration triggers degradation on critical snapshot', () => {
  // Reset store degradation level
  minimalPanelStore.updateState({
    metrics: {
      ...minimalPanelStore.getState().metrics,
      fps: 15,
      e2eLatency: { p50: 50, p95: 130, p99: 200 },
      slowConsumers: 5,
    },
    degradation: { ...minimalPanelStore.getState().degradation, level: 0 }
  })

  // Simulate incoming metrics update
  minimalPanelStore.handleMetricsUpdate({})

  const { degradation } = minimalPanelStore.getState()
  assert.ok(degradation.level >= 2, 'degradation level should escalate to >=2 on critical')
})

