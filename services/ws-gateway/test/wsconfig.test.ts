import { describe, it, expect } from 'vitest'
import { wsServerOptions } from '../src/wsconfig.js'

describe('ws server options', () => {
  it('disables permessage-deflate and caps payload', () => {
    const opts = wsServerOptions({} as any)
    expect((opts as any).perMessageDeflate).toBe(false)
    expect((opts as any).maxPayload).toBe(1024*1024)
    expect((opts as any).noServer).toBe(true)
  })
})

