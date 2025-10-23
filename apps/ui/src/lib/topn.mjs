/**
 * Rank groups by a combined score using slowConsumers and latency p95.
 * score = slow + p95/100 (lower latency better; higher score = worse)
 * @param {Record<string, number>} slowBy
 * @param {Record<string, number>} p95By
 * @returns {{ g: string, score: number }[]} sorted desc by score
 */
export function rankGroups(slowBy = {}, p95By = {}) {
  const groups = Array.from(new Set([...Object.keys(slowBy), ...Object.keys(p95By)]))
  const arr = groups.map(g => ({ g, score: Number(slowBy[g] || 0) + Number((p95By[g] || 0))/100 }))
  arr.sort((a,b)=> b.score - a.score)
  return arr
}

export default { rankGroups }

