import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const wsActiveConnections = new client.Gauge({
  name: 'xy_ws_active_connections',
  help: 'Active WebSocket connections',
});
// AC alias: active connections
export const wsActive = new client.Gauge({
  name: 'ws_active',
  help: 'Active WebSocket connections (alias to xy_ws_active_connections)',
});
export const wsMessagesForwarded = new client.Counter({
  name: 'xy_ws_messages_forwarded_total',
  help: 'Total messages forwarded to WebSocket clients',
});
// AC alias: forwarded message rate (messages/sec, sliding window)
// Rate is computed on scrape via Gauge.collect() to avoid background timers
export const wsMsgsRate = new client.Gauge({
  name: 'ws_msgs_rate',
  help: 'Approximate messages forwarded per second (computed on scrape)',
  collect() {
    const now = Date.now();
    const dt = now - lastRateCheck;
    if (dt > 0) {
      const delta = forwardedShadow - lastForwarded;
      const rate = delta * 1000 / dt; // msgs/sec
      this.set(Number.isFinite(rate) ? rate : 0);
      lastForwarded = forwardedShadow;
      lastRateCheck = now;
    } else {
      this.set(0);
    }
  },
});
export const wsMessagesDropped = new client.Counter({
  name: 'xy_ws_messages_dropped_total',
  help: 'Total messages dropped due to backpressure or filtering',
  labelNames: ['reason'],
});
export const wsSlowConsumers = new client.Counter({
  name: 'xy_ws_slow_consumers_total',
  help: 'Total number of slow consumer events detected',
});
// AC alias: slow consumer events total
export const slowConsumers = new client.Counter({
  name: 'slow_consumers',
  help: 'Slow consumer events (alias to xy_ws_slow_consumers_total)',
});
export const natsReconnects = new client.Counter({
  name: 'xy_nats_reconnects_total',
  help: 'Total number of NATS reconnection events',
});
// Control label cardinality: default to aggregated metric only; enable per-connection labels in diagnostics
const DIAGNOSTIC_METRICS = process.env.DIAGNOSTIC_METRICS === 'true';

// Aggregated gauge: max queue size across active connections (low cardinality)
export const wsSendQueueSizeMax = new client.Gauge({
  name: 'xy_ws_send_queue_size',
  help: 'Max outbound queue size across connections',
});

// Optional per-connection diagnostic gauge (high cardinality; disabled by default)
let wsSendQueueSizeDiag: client.Gauge<any> | null = null;
if (DIAGNOSTIC_METRICS) {
  wsSendQueueSizeDiag = new client.Gauge({
    name: 'xy_ws_send_queue_size_diagnostic',
    help: 'Per-connection outbound queue size (diagnostic use only)',
    labelNames: ['conn'],
  });
}

register.registerMetric(wsActiveConnections);
register.registerMetric(wsActive);
register.registerMetric(wsMessagesForwarded);
register.registerMetric(wsMsgsRate);
register.registerMetric(wsMessagesDropped);
register.registerMetric(wsSlowConsumers);
register.registerMetric(slowConsumers);
register.registerMetric(natsReconnects);
register.registerMetric(wsSendQueueSizeMax);
if (wsSendQueueSizeDiag) register.registerMetric(wsSendQueueSizeDiag);

export async function metricsText(): Promise<string> {
  return await register.metrics();
}

// Helpers to keep AC-alias metrics in sync with existing metrics
let forwardedShadow = 0;
let lastRateCheck = Date.now();
let lastForwarded = 0;

export function setWsActive(v: number) {
  wsActive.set(v);
}

export function recordForwarded(n = 1) {
  wsMessagesForwarded.inc(n);
  forwardedShadow += n;
}

export function recordSlowConsumer(n = 1) {
  wsSlowConsumers.inc(n);
  slowConsumers.inc(n);
}

// Queue size helpers with low-cardinality aggregate and optional diagnostics
const queueSizes = new Map<string, number>();

function recomputeQueueAgg() {
  let max = 0;
  for (const v of queueSizes.values()) if (v > max) max = v;
  wsSendQueueSizeMax.set(max);
}

export function updateQueueSize(conn: string, size: number) {
  queueSizes.set(conn, size);
  if (wsSendQueueSizeDiag) wsSendQueueSizeDiag.labels({ conn }).set(size);
  recomputeQueueAgg();
}

export function removeQueueSize(conn: string) {
  if (wsSendQueueSizeDiag) {
    try { (wsSendQueueSizeDiag as any).remove({ conn }); } catch {}
  }
  queueSizes.delete(conn);
  recomputeQueueAgg();
}
