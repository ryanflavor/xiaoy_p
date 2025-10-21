/** Check SharedArrayBuffer safety based on crossOriginIsolated */
export function checkSABSafe (g = globalThis) {
  const enabled = typeof g.SharedArrayBuffer === 'function'
  const coi = !!g.crossOriginIsolated
  const ok = !enabled || (enabled && coi)
  return { enabled, crossOriginIsolated: coi, ok }
}

