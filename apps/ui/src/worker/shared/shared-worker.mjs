// SharedWorker script (module) — single WebSocket connection + fanout to ports (JS/ESM)
import { WSManager } from "../../lib/ws/manager.mjs";

const ports = new Set();
let heartbeatTimer = null;

function ensureHeartbeat() {
  if (heartbeatTimer != null) return;
  heartbeatTimer = self.setInterval(() => {
    for (const p of ports) {
      try { p.postMessage({ kind: "heartbeat", ts: Date.now(), connections: WSManager.createdConnections }); } catch {}
    }
  }, 15000);
}

self.onconnect = (evt) => {
  const port = evt.ports && evt.ports[0];
  if (!port) return;
  ports.add(port);
  ensureHeartbeat();

  // Forward inbound WS messages to all ports as { kind: 'ws', data }
  WSManager.onMessage = (ev) => {
    const data = ev?.data
    const asText = async (d) => {
      try {
        if (typeof d === 'string') return d
        if (d instanceof ArrayBuffer) return new TextDecoder().decode(d)
        if (typeof Blob !== 'undefined' && d instanceof Blob) {
          return await d.text()
        }
        // Fallback: try to stringify
        return String(d)
      } catch {
        return '[unreadable]'
      }
    }
    Promise.resolve(asText(data)).then((text) => {
      let payload = text
      try { payload = JSON.parse(text) } catch {}
      for (const p of ports) {
        try { p.postMessage({ kind: 'ws', payload }) } catch {}
      }
    })
  }

  port.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.kind === "init" && typeof msg.url === "string") {
      // Prefer query param token for compatibility; avoid subprotocol negotiation flakiness
      const u = (() => { try { return new URL(msg.url, 'http://localhost') } catch { return null } })()
      let urlStr = msg.url
      if (u && msg.token) { u.searchParams.set('token', String(msg.token)); urlStr = u.toString().replace('http://localhost', '') }
      WSManager.connect({ url: urlStr });
      port.postMessage({ kind: "ready", createdConnections: WSManager.createdConnections });
      return;
    }
    if (msg.kind === "close") {
      try { port.close && port.close(); } catch {}
      ports.delete(port);
      if (ports.size === 0 && heartbeatTimer != null) {
        self.clearInterval && self.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      return;
    }
    if (msg.kind === "health") {
      port.postMessage({ kind: "health", data: WSManager.health() });
      return;
    }
    if (msg.kind === "slow-consumer") {
      WSManager.recordSlowConsumer();
      port.postMessage({ kind: "ack", what: "slow-consumer" });
      return;
    }
    if (msg.kind === 'subscribe' && typeof msg.topic === 'string') {
      try { WSManager.addSubscription(msg.topic) } catch {}
      port.postMessage({ kind: 'ack', what: 'subscribe', topic: msg.topic })
      return
    }
    if (msg.kind === 'unsubscribe' && typeof msg.topic === 'string') {
      try { WSManager.removeSubscription(msg.topic) } catch {}
      port.postMessage({ kind: 'ack', what: 'unsubscribe', topic: msg.topic })
      return
    }
    if (msg.kind === 'disconnect') {
      WSManager.disconnect({ reconnect: true })
      port.postMessage({ kind: 'ack', what: 'disconnect' })
      return
    }
    if (msg.kind === "broadcast") {
      for (const p of ports) p.postMessage({ kind: "message", payload: msg.payload });
      return;
    }
  };

  port.start && port.start();
  port.postMessage({ kind: "hello", ports: ports.size, createdConnections: WSManager.createdConnections });

  // Remove on error to avoid leaks
  port.onmessageerror = () => {
    ports.delete(port);
    if (ports.size === 0 && heartbeatTimer != null) {
      self.clearInterval && self.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };
};
