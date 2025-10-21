import { subscribe } from '../lib/metrics/api.mjs'

/** Attach a simple diagnostics overlay when enabled. */
export function attachMetricsOverlay (opts = {}) {
  const enabled = opts.enabled ?? isDebugEnabled()
  if (!enabled) return () => {}
  const root = document.createElement('div')
  root.style.cssText = 'position:fixed;right:8px;top:8px;background:rgba(0,0,0,.65);color:#fff;padding:8px 10px;border-radius:6px;font:12px ui-monospace,monospace;z-index:999999;'
  root.innerHTML = '<b>Metrics</b><div id="xy-fps">FPS: -</div><div id="xy-lat">e2e p50/p95/p99: -</div><div id="xy-slow">slow: 0</div>'
  document.body.appendChild(root)
  const fpsEl = root.querySelector('#xy-fps')
  const latEl = root.querySelector('#xy-lat')
  const scEl = root.querySelector('#xy-slow')
  return subscribe((snap)=>{
    const fps = snap.gauges?.ui_fps ?? 0
    const lat = snap.latencies?.ui_e2e_latency_ms ?? { p50:0,p95:0,p99:0 }
    const slow = snap.counters?.ui_slow_consumers ?? 0
    fpsEl.textContent = `FPS: ${fps}`
    latEl.textContent = `e2e p50/p95/p99: ${Math.round(lat.p50)}/${Math.round(lat.p95)}/${Math.round(lat.p99)}`
    scEl.textContent = `slow: ${slow}`
  }, opts.intervalMs ?? 500)
}

function isDebugEnabled () {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '')
    if (q.get('debug') === '1') return true
    if (globalThis.localStorage?.getItem('xy_debug') === '1') return true
  } catch {}
  return false
}

