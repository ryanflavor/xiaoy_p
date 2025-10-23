import type { ServerOptions as WebSocketServerOptions } from 'ws'
import type { AppConfig } from './config.js'
// Type-only reference ensures consumers link generated contracts
// without introducing a runtime dependency in this module
import type { Tick } from '@xiaoy/ts-contracts'
// Re-export a type alias to ensure usage and keep tree-shakers from dropping the import
export type _LinkedContracts_Tick = Tick

export function wsServerOptions(_cfg: AppConfig): WebSocketServerOptions {
  return {
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 1024 * 1024, // 1 MiB safety cap
    // Select a subprotocol if the client offered any; prefer 'bearer'
    handleProtocols: (protocols: Set<string>) => {
      if (protocols.has('bearer')) return 'bearer'
      // pick first deterministically to satisfy some clients
      for (const p of protocols) return p
      return false
    },
  }
}
