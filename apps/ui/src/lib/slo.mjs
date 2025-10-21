/** Simple SLO checker driven by config */

export function loadSloConfig (cfg = null) {
  // Caller may provide cfg; demo server serves demo/slo.json when used in browser
  return cfg || {
    fps: { p95Min: 55 },
    e2eLatencyMs: { p95Max: 120, p99Max: 180, budgetWindow: 60000, budgetAllowed: 5 },
  }
}

/**
 * Check snapshot against SLO config.
 * Returns array of { type, level, metric, value, threshold }
 */
export function checkSlo (snapshot, cfg) {
  const out = []
  const c = loadSloConfig(cfg)
  // FPS
  const fps = snapshot.gauges?.ui_fps ?? 0
  if (fps && c.fps?.p95Min && fps < c.fps.p95Min) {
    out.push({ type: 'slo', level: 'warn', metric: 'ui_fps', value: fps, threshold: c.fps.p95Min })
  }
  // E2E latency
  const lat = snapshot.latencies?.ui_e2e_latency_ms
  if (lat && lat.p95 && c.e2eLatencyMs?.p95Max && lat.p95 > c.e2eLatencyMs.p95Max) {
    out.push({ type: 'slo', level: 'error', metric: 'ui_e2e_latency_ms.p95', value: lat.p95, threshold: c.e2eLatencyMs.p95Max })
  }
  if (lat && lat.p99 && c.e2eLatencyMs?.p99Max && lat.p99 > c.e2eLatencyMs.p99Max) {
    out.push({ type: 'slo', level: 'error', metric: 'ui_e2e_latency_ms.p99', value: lat.p99, threshold: c.e2eLatencyMs.p99Max })
  }
  return out
}

