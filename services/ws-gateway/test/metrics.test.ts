import { describe, it, expect } from 'vitest'
import { register, recordSlowConsumer, natsReconnects } from '../src/metrics.js'

describe('metrics registered', () => {
  it('has slow consumers and reconnects counters (including AC aliases)', async () => {
    await register.getSingleMetricAsString('xy_ws_slow_consumers_total').catch(() => '')
    recordSlowConsumer()
    const afterSlow = await register.getSingleMetricAsString('xy_ws_slow_consumers_total')
    expect(afterSlow).toContain('xy_ws_slow_consumers_total')
    // alias also present
    const aliasSlow = await register.getSingleMetricAsString('slow_consumers')
    expect(aliasSlow).toContain('slow_consumers')

    await register.getSingleMetricAsString('xy_nats_reconnects_total').catch(() => '')
    natsReconnects.inc()
    const afterRec = await register.getSingleMetricAsString('xy_nats_reconnects_total')
    expect(afterRec).toContain('xy_nats_reconnects_total')

    // AC alias gauges exist
    const active = await register.getSingleMetricAsString('ws_active').catch(() => '')
    expect(active).toContain('ws_active')
    const rate = await register.getSingleMetricAsString('ws_msgs_rate').catch(() => '')
    expect(rate).toContain('ws_msgs_rate')
  })
})
