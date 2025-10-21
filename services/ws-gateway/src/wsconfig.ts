import type { WebSocketServerOptions } from 'ws'
import type { AppConfig } from './config.js'

export function wsServerOptions(cfg: AppConfig): WebSocketServerOptions {
  return {
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 1024 * 1024, // 1 MiB safety cap
  }
}

