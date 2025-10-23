// SLO/SLI helpers: threshold evaluation and error budget burn rate

/** Compute allowed error budget time (ms) for a window given target availability. */
export function errorBudgetMs(windowMs, targetAvailability) {
  const budget = Math.max(0, 1 - Number(targetAvailability)) * Number(windowMs)
  return Math.round(budget)
}

/**
 * Compute burned bad time (ms) from boolean samples within a window.
 * samples: [{ ts: number, bad: boolean }], assumed sorted by ts (ascending).
 * Uses step-wise integration between consecutive samples; last sample clamps to window end.
 */
export function badTimeFromSamples(samples, windowEndTs, windowMs) {
  if (!Array.isArray(samples) || samples.length === 0) return 0
  const windowStart = windowEndTs - windowMs
  let lastTs = Math.max(windowStart, samples[0].ts)
  let lastBad = !!samples[0].bad
  let burned = 0
  for (let i = 1; i < samples.length; i++) {
    const ts = samples[i].ts
    const bad = !!samples[i].bad
    const clampedTs = Math.min(ts, windowEndTs)
    if (clampedTs > lastTs && lastBad) burned += clampedTs - lastTs
    lastTs = Math.max(lastTs, clampedTs)
    lastBad = bad
    if (lastTs >= windowEndTs) break
  }
  // Tail to window end
  if (lastTs < windowEndTs && lastBad) burned += windowEndTs - lastTs
  return Math.max(0, Math.min(burned, windowMs))
}

/** Compute burn rate = badMs / budgetMs (unitless). */
export function burnRate(badMs, budgetMs) {
  if (budgetMs <= 0) return badMs > 0 ? Infinity : 0
  return Number(badMs) / Number(budgetMs)
}

/**
 * Evaluate one snapshot against thresholds.
 * snapshot: { fps, e2eLatency: {p50,p95,p99}, slowConsumers }
 * config: { latency:{p95Warn,p99Crit}, fps:{warn,crit}, slowConsumers:{warn,crit} }
 * Returns: { level: 'ok'|'warn'|'crit', details: {keys...} }
 */
export function evaluateSnapshot(snapshot, config) {
  const det = {}
  let level = 'ok'

  if (snapshot?.e2eLatency?.p95 > config.latency.p95Warn) {
    det.latencyP95 = 'warn'
    level = maxLevel(level, 'warn')
  }
  if (snapshot?.e2eLatency?.p99 > config.latency.p99Crit) {
    det.latencyP99 = 'crit'
    level = maxLevel(level, 'crit')
  }

  if (snapshot?.fps > 0 && snapshot.fps < config.fps.crit) {
    det.fps = 'crit'
    level = maxLevel(level, 'crit')
  } else if (snapshot?.fps > 0 && snapshot.fps < config.fps.warn) {
    det.fps = 'warn'
    level = maxLevel(level, 'warn')
  }

  if (typeof snapshot?.slowConsumers === 'number') {
    if (snapshot.slowConsumers >= config.slowConsumers.crit) {
      det.slowConsumers = 'crit'
      level = maxLevel(level, 'crit')
    } else if (snapshot.slowConsumers >= config.slowConsumers.warn) {
      det.slowConsumers = 'warn'
      level = maxLevel(level, 'warn')
    }
  }

  return { level, details: det }
}

function maxLevel(a, b) {
  const order = { ok: 0, warn: 1, crit: 2 }
  return (order[b] > order[a]) ? b : a
}

/**
 * Convenience: compute burn rates (5m/1h) from boolean samples and config.
 * Returns { burn5m, burn1h, budget5mMs, budget1hMs }
 */
export function computeBurnRates(samples, nowTs, config) {
  const b5 = errorBudgetMs(config.errorBudget.window5mMs, config.errorBudget.targetAvailability)
  const b60 = errorBudgetMs(config.errorBudget.window1hMs, config.errorBudget.targetAvailability)
  const bad5 = badTimeFromSamples(samples, nowTs, config.errorBudget.window5mMs)
  const bad60 = badTimeFromSamples(samples, nowTs, config.errorBudget.window1hMs)
  return {
    burn5m: burnRate(bad5, b5),
    burn1h: burnRate(bad60, b60),
    budget5mMs: b5,
    budget1hMs: b60,
  }
}

export default {
  errorBudgetMs,
  badTimeFromSamples,
  burnRate,
  evaluateSnapshot,
  computeBurnRates,
}

