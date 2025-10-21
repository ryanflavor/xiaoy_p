import { describe, it, expect } from 'vitest'
import { register, wsSlowConsumers, natsReconnects } from '../src/metrics.js'

describe('metrics registered', () => {
  it('has slow consumers and reconnects counters', async () => {
    const beforeSlow = await register.getSingleMetricAsString('xy_ws_slow_consumers_total').catch(() => '')
    wsSlowConsumers.inc()
    const afterSlow = await register.getSingleMetricAsString('xy_ws_slow_consumers_total')
    expect(afterSlow).toContain('xy_ws_slow_consumers_total')

    const beforeRec = await register.getSingleMetricAsString('xy_nats_reconnects_total').catch(() => '')
    natsReconnects.inc()
    const afterRec = await register.getSingleMetricAsString('xy_nats_reconnects_total')
    expect(afterRec).toContain('xy_nats_reconnects_total')
  })
})

