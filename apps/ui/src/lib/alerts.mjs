// Simple alerting hook that evaluates snapshot against SLO config
// and emits callbacks for warn/crit events. Intended to wire to
// degradation controls (sampling/field trimming/stop updates).

import { evaluateSnapshot } from './slo.mjs'

/**
 * @param {object} snapshot - { fps, e2eLatency:{p50,p95,p99}, slowConsumers }
 * @param {object} config - sloConfig
 * @param {object} opts - { onWarn?, onCrit?, recorder? }
 */
export function evaluateAndEmit(snapshot, config, opts = {}) {
  const res = evaluateSnapshot(snapshot, config)
  if (res.level === 'crit' && typeof opts.onCrit === 'function') opts.onCrit(res)
  else if (res.level === 'warn' && typeof opts.onWarn === 'function') opts.onWarn(res)
  if (typeof opts.recorder === 'function') opts.recorder({ ts: Date.now(), level: res.level, details: res.details })
  return res
}

export default { evaluateAndEmit }

