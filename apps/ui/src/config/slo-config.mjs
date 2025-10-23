// SLO/SLA threshold configuration and error budget windows
// Values align with PRD (P95<120ms, P99<180ms) and Story 1.6/1.7 constraints

export const sloConfig = {
  // Latency thresholds in milliseconds
  latency: {
    p95Warn: 120,
    p99Crit: 180,
  },

  // UI frame rate thresholds (frames per second)
  fps: {
    warn: 30,
    crit: 20,
  },

  // Slow consumer event count thresholds (per scrape/window)
  slowConsumers: {
    warn: 1,
    crit: 3,
  },

  // Error budget windows and target availability
  errorBudget: {
    // Target availability for trading hours
    targetAvailability: 0.999, // 99.9%
    window5mMs: 5 * 60 * 1000,
    window1hMs: 60 * 60 * 1000,
  },
}

export default sloConfig

