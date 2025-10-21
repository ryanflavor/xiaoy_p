import { describe, it, expect } from 'vitest'
import { decodeTick, collectUnknowns } from '../src/index.js'

describe('decodeTick tolerates unknown fields', () => {
  it('keeps core fields and counts unknowns', () => {
    const u = collectUnknowns()
    const msg = { ts_ms: 1, symbol: 'AAPL', price: 123.45, volume: 10, extra: 42, foo: 'bar' }
    const t = decodeTick(msg, { onUnknownField: u.onUnknownField })
    expect(t.symbol).toBe('AAPL')
    const stats = u.result()
    expect(stats.count).toBe(2)
    expect(new Set(stats.names)).toEqual(new Set(['extra', 'foo']))
  })

  it('throws when required fields missing', () => {
    expect(() => decodeTick({ symbol: 'AAPL' } as any)).toThrow()
  })
})
