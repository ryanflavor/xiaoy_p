// SharedWorker script (module) — single WebSocket connection + fanout to ports
// This file is intended to be referenced by pages: new SharedWorker('shared-worker.js', { type: 'module' })

import { WSManager } from "../../lib/ws/manager.mjs";
import type { Tick } from "@xiaoy/ts-contracts"; // consumer reference (type-only)
export type _LinkedContracts_Tick = Tick;

declare const self: SharedWorkerGlobalScope & { name?: string };

type Port = MessagePort;

const ports = new Set<Port>();
let heartbeatTimer: number | null = null;

function ensureHeartbeat() {
  if (heartbeatTimer != null) return;
  heartbeatTimer = (self as any).setInterval(() => {
    for (const p of ports) {
      try {
        p.postMessage({ kind: "heartbeat", ts: Date.now(), connections: WSManager.createdConnections });
      } catch {
        // ignore
      }
    }
  }, 15000) as unknown as number; // 15s heartbeat
}

function _initSocket() {
  // URL should be provided by page via first message; use placeholder here
  // The first connected port is expected to send {kind: 'init', url: 'wss://...'}
}

self.onconnect = (evt: MessageEvent) => {
  const port = (evt as any).ports?.[0] as Port;
  if (!port) return;
  ports.add(port);
  ensureHeartbeat();

  port.onmessage = (e: MessageEvent) => {
    const msg = e.data ?? {};
    if (msg.kind === "init" && typeof msg.url === "string") {
      // Create or reuse the single WebSocket connection
      WSManager.connect({ url: msg.url });
      port.postMessage({ kind: "ready", createdConnections: WSManager.createdConnections });
      return;
    }
    if (msg.kind === "close") {
      try { port.close?.() } catch { void 0 }
      ports.delete(port);
      if (ports.size === 0 && heartbeatTimer != null) {
        (self as any).clearInterval?.(heartbeatTimer);
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
    if (msg.kind === "subscribe" && typeof msg.topic === 'string') {
      try { WSManager.addSubscription(msg.topic) } catch { void 0 }
      port.postMessage({ kind: "ack", what: "subscribe", topic: msg.topic });
      return;
    }
    if (msg.kind === "unsubscribe" && typeof msg.topic === 'string') {
      try { WSManager.removeSubscription(msg.topic) } catch { void 0 }
      port.postMessage({ kind: "ack", what: "unsubscribe", topic: msg.topic });
      return;
    }
    if (msg.kind === "disconnect") {
      // trigger disconnect with auto-reconnect path
      WSManager.disconnect({ reconnect: true });
      port.postMessage({ kind: "ack", what: "disconnect" });
      return;
    }
    if (msg.kind === "broadcast") {
      // Fan out to all ports (including sender)
      for (const p of ports) p.postMessage({ kind: "message", payload: msg.payload });
      return;
    }
  };

  port.start?.();

  // Initial hello
  port.postMessage({ kind: "hello", ports: ports.size, createdConnections: WSManager.createdConnections });
  // Remove on error to avoid leaks
  (port as any).onmessageerror = () => {
    ports.delete(port);
    if (ports.size === 0 && heartbeatTimer != null) {
      (self as any).clearInterval?.(heartbeatTimer);
      heartbeatTimer = null;
    }
  };
};

// Close handling — when all ports close we keep the socket as-is (page policy decides when to close)
