import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const wsActiveConnections = new client.Gauge({
  name: 'xy_ws_active_connections',
  help: 'Active WebSocket connections',
});
export const wsMessagesForwarded = new client.Counter({
  name: 'xy_ws_messages_forwarded_total',
  help: 'Total messages forwarded to WebSocket clients',
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
export const natsReconnects = new client.Counter({
  name: 'xy_nats_reconnects_total',
  help: 'Total number of NATS reconnection events',
});
export const wsSendQueueSize = new client.Gauge({
  name: 'xy_ws_send_queue_size',
  help: 'Current outbound queue size per-connection',
  labelNames: ['conn'],
});

register.registerMetric(wsActiveConnections);
register.registerMetric(wsMessagesForwarded);
register.registerMetric(wsMessagesDropped);
register.registerMetric(wsSlowConsumers);
register.registerMetric(natsReconnects);
register.registerMetric(wsSendQueueSize);

export async function metricsText(): Promise<string> {
  return await register.metrics();
}

