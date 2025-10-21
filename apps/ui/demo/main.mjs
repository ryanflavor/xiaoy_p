import { createFpsMeter } from '../src/lib/metrics/metrics.mjs'

const $ = (id) => document.getElementById(id)
const hb = $('hb'), out = $('out'), health = $('health')
const fpsEl = $('fps'), connEl = $('conn'), portsEl = $('ports')

// Start FPS meter
const meter = createFpsMeter()
meter.start()
setInterval(() => { fpsEl.textContent = String(meter.fps()) }, 250)

// Start SharedWorker (fallback:提示不支持)
if (typeof SharedWorker !== 'function') {
  out.textContent = '此浏览器不支持 SharedWorker。请使用 Chrome/Edge/Firefox 桌面版或 Android Chrome。'
}
const worker = typeof SharedWorker === 'function'
  ? new SharedWorker('../src/worker/shared/shared-worker.mjs', { type: 'module' })
  : null
const port = worker ? worker.port : { start(){}, postMessage(){}, onmessage:null }
window.demoPort = port
port.start()

port.onmessage = (e) => {
  const msg = e.data || {}
  if (msg.kind === 'hello') {
    connEl.textContent = String(msg.createdConnections || 0)
    portsEl.textContent = String(msg.ports || 1)
    out.textContent = `hello: ports=${msg.ports}, createdConnections=${msg.createdConnections}`
  } else if (msg.kind === 'heartbeat') {
    connEl.textContent = String(msg.connections || 0)
    hb.textContent = `${new Date(msg.ts).toLocaleTimeString()} · connections=${msg.connections}\n` + hb.textContent
  } else if (msg.kind === 'health') {
    health.textContent = JSON.stringify(msg.data, null, 2)
  } else if (msg.kind === 'message') {
    out.textContent = JSON.stringify(msg.payload, null, 2)
  } else if (msg.kind === 'ws') {
    try {
      out.textContent = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload, null, 2)
    } catch {
      out.textContent = String(msg.payload)
    }
  } else if (msg.kind === 'ack') {
    const details = msg.topic ? ` ${msg.topic}` : ''
    out.textContent = `ack: ${msg.what}${details}`
    if (msg.what === 'subscribe' || msg.what === 'unsubscribe') {
      try { port.postMessage({ kind: 'health' }) } catch {}
    }
  }
}

// UI events
// prefill from URL params if present
try {
  const params = new URL(location.href).searchParams
  const u = params.get('url'); if (u) $('wsUrl').value = u
  const tk = params.get('token'); if (tk) $('wsToken').value = tk
} catch {}

$('btnConnect').onclick = () => {
  const url = $('wsUrl').value || 'ws://localhost:8080/ws'
  const token = $('wsToken').value || ''
  port.postMessage({ kind: 'init', url, token })
}
// Auto-connect if url+token prefilled (from query or previous state)
;(function autoConnectIfReady(){
  try {
    const url = $('wsUrl')?.value?.trim()
    const token = $('wsToken')?.value?.trim()
    if (url && token) port.postMessage({ kind: 'init', url, token })
  } catch {}
})()
$('btnHealth').onclick = () => port.postMessage({ kind: 'health' })
$('btnSlow').onclick = () => port.postMessage({ kind: 'slow-consumer' })
$('btnSub').onclick = () => port.postMessage({ kind: 'subscribe', topic: $('subTopic').value || 'xy.md.tick.demo' })
$('btnUnsub').onclick = () => port.postMessage({ kind: 'unsubscribe', topic: $('subTopic').value || 'xy.md.tick.demo' })
$('btnBroadcast').onclick = () => port.postMessage({ kind: 'broadcast', payload: { from: location.href, text: $('broadcastText').value || 'hello' } })
$('btnReconnect').onclick = () => port.postMessage({ kind: 'disconnect' })

window.addEventListener('beforeunload', () => port.postMessage({ kind: 'close' }))
