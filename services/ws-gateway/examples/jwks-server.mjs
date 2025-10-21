import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'

const host = '0.0.0.0'
const port = Number(process.env.JWKS_PORT || '8089')
const path = process.env.JWKS_PATH || '/jwks.json'
const file = process.env.JWKS_FILE || '/app/.demo_jwks.json'

if (!existsSync(file)) {
  console.error('JWKS file not found:', file)
  process.exit(1)
}

const jwks = readFileSync(file)
const srv = http.createServer((req, res) => {
  if (req.url === path) {
    res.setHeader('content-type', 'application/json')
    res.end(jwks)
  } else {
    res.statusCode = 404
    res.end('not found')
  }
})

srv.listen(port, host, () => {
  console.log(`JWKS server listening on http://${host}:${port}${path}`)
})

