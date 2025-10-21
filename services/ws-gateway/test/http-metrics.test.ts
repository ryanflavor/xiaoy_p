import { describe, it, expect } from 'vitest'
import http from 'node:http'
import { metricsText } from '../src/metrics.js'

describe('http /metrics endpoint (smoke)', () => {
  it('returns 200 and contains custom metrics', async () => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost')
        if (url.pathname === '/metrics') {
          res.setHeader('content-type', 'text/plain; version=0.0.4')
          res.end(await metricsText())
          return
        }
        res.statusCode = 404
        res.end('not found')
      } catch (e) {
        res.statusCode = 500
        res.end('error')
      }
    })

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    const resp = await fetch(`http://127.0.0.1:${port}/metrics`)
    const text = await resp.text()
    server.close()

    expect(resp.status).toBe(200)
    expect(text).toContain('ws_msgs_rate')
    expect(text).toMatch(/xy_ws_active_connections|ws_active/)
  })
})

