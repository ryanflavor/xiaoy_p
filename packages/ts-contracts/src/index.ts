export type Tick = {
  ts_ms: number
  symbol: string
  price: number
  volume?: number
}

export type DecodeOptions = {
  onUnknownField?: (name: string, value: unknown) => void
}

export function decodeTick(input: any, opts: DecodeOptions = {}): Tick {
  const obj: any = typeof input === 'string' ? JSON.parse(input) : input
  if (typeof obj !== 'object' || obj == null) {
    throw new TypeError('Tick must be an object or JSON string')
  }
  const out: Tick = {
    ts_ms: Number(obj.ts_ms ?? obj.ts ?? 0),
    symbol: String(obj.symbol ?? ''),
    price: Number(obj.price ?? NaN),
  }
  if ('volume' in obj) out.volume = Number(obj.volume)

  for (const k of Object.keys(obj)) {
    if (!(k in out) && k !== 'volume') {
      opts.onUnknownField?.(k, (obj as any)[k])
    }
  }
  if (!Number.isFinite(out.price) || !Number.isFinite(out.ts_ms) || !out.symbol) {
    throw new Error('Tick missing required fields')
  }
  return out
}

export function collectUnknowns() {
  const acc = { count: 0, names: new Set<string>() }
  return {
    onUnknownField(name: string) {
      acc.count++
      acc.names.add(name)
    },
    result() {
      return { count: acc.count, names: [...acc.names] }
    }
  }
}

