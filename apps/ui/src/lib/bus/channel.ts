// Cross-tab/channel abstraction. Prefers BroadcastChannel, can fall back to MessagePort style

export type Unsubscribe = () => void;

export interface Bus {
  publish: (msg: any) => void;
  subscribe: (cb: (msg: any) => void) => Unsubscribe;
  close: () => void;
}

export function createBroadcastBus(name: string): Bus {
  // Prefer native BroadcastChannel when available
  const G: any = globalThis as any;
  if (typeof G.BroadcastChannel === "function") {
    const ch = new G.BroadcastChannel(name);
    let handler: ((e: MessageEvent) => void) | null = null;
    return {
      publish: (msg: any) => ch.postMessage(msg),
      subscribe: (cb) => {
        handler = (e: MessageEvent) => cb(e.data);
        ch.addEventListener("message", handler);
        return () => {
          if (handler) ch.removeEventListener("message", handler);
          handler = null;
        };
      },
      close: () => ch.close(),
    };
  }

  // Minimal fallback: in non-browser tests we emulate a local bus using an EventTarget
  const et = new (class extends EventTarget {
    emit(data: any) {
      this.dispatchEvent(new MessageEvent("message", { data }));
    }
  })();
  let on: any = null;
  return {
    publish: (msg: any) => (et as any).emit(msg),
    subscribe: (cb) => {
      on = (e: MessageEvent) => cb(e.data);
      et.addEventListener("message", on);
      return () => et.removeEventListener("message", on);
    },
    close: () => on && et.removeEventListener("message", on),
  };
}

