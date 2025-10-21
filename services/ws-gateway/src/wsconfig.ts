import type { WebSocketServerOptions } from 'ws'
import type { AppConfig } from './config.js'
// Type-only reference ensures consumers link generated contracts
// without introducing a runtime dependency in this module
import type { Tick } from '@xiaoy/ts-contracts'

export function wsServerOptions(cfg: AppConfig): WebSocketServerOptions {
  return {
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 1024 * 1024, // 1 MiB safety cap
  }
}
