import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import os from 'node:os'

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
const port = process.env.PORT ? Number(process.env.PORT) : 5174

const mime = (p) => {
  if (p.endsWith('.html')) return 'text/html; charset=utf-8'
  if (p.endsWith('.mjs') || p.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (p.endsWith('.css')) return 'text/css; charset=utf-8'
  if (p.endsWith('.json')) return 'application/json; charset=utf-8'
  return 'text/plain; charset=utf-8'
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`)
  let filePath = decodeURIComponent(u.pathname)
  if (filePath === '/' ) filePath = '/demo/index.html'
  const abs = path.join(root, filePath)
  if (!abs.startsWith(root)) { res.writeHead(403).end('forbidden'); return }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return }
    res.writeHead(200, { 'content-type': mime(abs) })
    res.end(data)
  })
})

const host = '0.0.0.0'
server.listen(port, host, () => {
  const nets = os.networkInterfaces()
  const addrs = []
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) addrs.push(n.address)
    }
  }
  console.log(`SharedWorker demo server running:`)
  console.log(`  • Local:  http://localhost:${port}/demo/`)
  for (const a of addrs) console.log(`  • LAN:    http://${a}:${port}/demo/`)
})
