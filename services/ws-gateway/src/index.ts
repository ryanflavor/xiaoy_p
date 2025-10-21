import http from 'node:http';
import https from 'node:https';
import url from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import { connect, StringCodec, type NatsConnection, type Subscription } from 'nats';
import { loadConfig } from './config.js';
import { compileWhitelist, isSubjectAllowed } from './acl.js';
import { metricsText, wsActiveConnections, wsMessagesDropped, natsReconnects, setWsActive, recordForwarded, recordSlowConsumer, updateQueueSize, removeQueueSize } from './metrics.js';
import { OutboundQueue } from './queue.js';
import { extractTokenFromHeaders, verifyJwt } from './jwt.js';
import { wsServerOptions } from './wsconfig.js';

const cfg = loadConfig();
const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { svc: 'ws-gateway' },
});

const allowRes = compileWhitelist(cfg.whitelist);

let natsConn: NatsConnection | null = null;

async function connectNats(): Promise<NatsConnection> {
  if (natsConn) return natsConn;
  const urls = cfg.NATS_URLS.split(',').map(s => s.trim()).filter(Boolean);
  natsConn = await connect({
    servers: urls,
    tls: cfg.NATS_TLS_ENABLE ? {
      ca: cfg.natsTls?.ca?.toString(),
      cert: cfg.natsTls?.cert?.toString(),
      key: cfg.natsTls?.key?.toString(),
    } : undefined,
  });
  // Observe connection status events to increment reconnect metrics
  (async () => {
    try {
      for await (const s of natsConn!.status()) {
        if (s.type === 'reconnect' || s.type === 'reconnecting') {
          natsReconnects.inc();
        }
      }
    } catch (e) {
      log.warn({ e }, 'status loop closed');
    }
  })();
  natsConn.closed().then((err) => {
    log.error({ err }, 'XYW004 NATS connection closed');
    natsConn = null;
  });
  return natsConn;
}

type ClientCtx = {
  id: string;
  socket: WebSocket;
  subs: Subscription[];
  queue: OutboundQueue<Uint8Array>;
};

const clients = new Map<string, ClientCtx>();
const sc = StringCodec();

function newClientId() { return Math.random().toString(36).slice(2, 10); }

async function handleUpgrade(req: http.IncomingMessage, socket: any, head: Buffer, server: http.Server | https.Server, wss: WebSocketServer) {
  try {
    // Origin check
    const origin = req.headers['origin'] as string | undefined;
    if (cfg.allowedOrigins !== '*' && origin && !cfg.allowedOrigins.includes(origin)) {
      log.warn({ origin }, 'XYW001 origin not allowed');
      socket.destroy();
      return;
    }

    const parsed = url.parse(req.url || '', true);
    const token = extractTokenFromHeaders(req.headers as any, (parsed.query['token'] as string | undefined) ?? null);
    if (!token) {
      log.warn('XYW001 missing token');
      socket.destroy();
      return;
    }
    await verifyJwt(token, {
      jwksUrl: cfg.JWT_JWKS_URL || undefined,
      publicKeyPemPathOrString: cfg.JWT_PUBLIC_KEY || undefined,
      allowedAud: cfg.allowedAud,
      allowedIss: cfg.allowedIss,
    });

    if (parsed.pathname !== cfg.WS_PATH) {
      socket.destroy();
      return;
    }

    (server as any).emit('upgrade-verified', req);
    wss.handleUpgrade(req, socket, head, function done(ws) {
      wss.emit('connection', ws, req);
    });
  } catch (err) {
    log.warn({ err }, 'XYW001 token verification failed');
    try { socket.destroy(); } catch {}
  }
}

async function main() {
  const server = cfg.TLS_ENABLE
    ? https.createServer({
        cert: cfg.tls!.cert,
        key: cfg.tls!.key,
        ca: cfg.tls?.ca,
      })
    : http.createServer();

  // Production safety notice
  if ((process.env.NODE_ENV === 'production') && cfg.allowedOrigins === '*') {
    log.warn('XYW010 ALLOWED_ORIGINS is "*" in production; set ALLOWED_ORIGINS to a CSV of trusted origins.');
  }

  const wss = new WebSocketServer(wsServerOptions(cfg));

  server.on('upgrade', (req, socket, head) => handleUpgrade(req, socket, head, server, wss));

  wss.on('connection', async (ws, req) => {
    const id = newClientId();
    const ctx: ClientCtx = { id, socket: ws, subs: [], queue: new OutboundQueue(cfg.WS_SEND_QUEUE_MAX) };
    clients.set(id, ctx);
    wsActiveConnections.inc();
    setWsActive(clients.size);
    log.info({ id }, 'client connected');

    const nc = await connectNats();

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && Array.isArray(msg.subjects)) {
          // Clear existing subscriptions first
          for (const s of ctx.subs) try { s.unsubscribe(); } catch {}
          ctx.subs = [];
          for (const subj of msg.subjects) {
            if (!isSubjectAllowed(subj, allowRes)) {
              log.warn({ id, subj }, 'XYW002 subject not allowed');
              continue;
            }
            const sub = nc.subscribe(subj);
            (async () => {
              for await (const m of sub) {
                const payload = m.data; // Uint8Array
                // Backpressure check
                if (ws.readyState !== WebSocket.OPEN) continue;
                if (!ctx.queue.push(payload).ok) {
                  wsMessagesDropped.labels({ reason: 'queue_full' }).inc();
                  continue;
                }
                updateQueueSize(id, ctx.queue.size());
                flushQueue(ctx);
              }
            })().catch((e) => log.error({ e }, 'subscription loop error'));
            ctx.subs.push(sub);
          }
        }
      } catch (e) {
        log.warn({ e }, 'invalid client message');
      }
    });

    ws.on('close', () => {
      for (const s of ctx.subs) try { s.unsubscribe(); } catch {}
      clients.delete(id);
      wsActiveConnections.dec();
      setWsActive(clients.size);
      removeQueueSize(id);
      log.info({ id }, 'client disconnected');
    });
  });

  server.on('request', async (req, res) => {
    if (!req.url) return res.end();
    const { pathname } = url.parse(req.url);
    if (pathname === cfg.HEALTH_PATH) {
      const healthy = !!natsConn;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ natsConnected: healthy, clients: clients.size }));
      return;
    }
    if (pathname === cfg.METRICS_PATH) {
      res.setHeader('content-type', 'text/plain; version=0.0.4');
      res.end(await metricsText());
      return;
    }
  });

  server.listen(cfg.PORT, cfg.HOST, () => {
    log.info({ host: cfg.HOST, port: cfg.PORT, tls: cfg.TLS_ENABLE }, 'server listening');
  });

  // Proactively establish NATS connection so /healthz becomes ready before first WS client
  connectNats().catch((e) => log.warn({ e }, 'failed to preconnect NATS'));
}

function flushQueue(ctx: ClientCtx) {
  if (ctx.socket.readyState !== WebSocket.OPEN) return;
  const before = ctx.queue.size();
  ctx.queue.drain((buf) => {
    try {
      ctx.socket.send(buf, { binary: true }, (err) => {
        if (err) {
          wsMessagesDropped.labels({ reason: 'send_error' }).inc();
        } else {
          recordForwarded();
        }
      });
    } catch {
      wsMessagesDropped.labels({ reason: 'send_throw' }).inc();
    }
  });
  updateQueueSize(ctx.id, 0);
  if (before > 0 && ctx.queue.size() === 0 && ctx.socket.bufferedAmount > 1024 * 1024) {
    // Basic slow consumer heuristic: buffered outgoing bytes exceed 1MiB
    recordSlowConsumer();
  }
}

main().catch((e) => {
  log.error({ e }, 'fatal');
  process.exit(1);
});
