import { WebSocket } from 'ws'

const url = process.env.WS_URL || 'ws://localhost:8080/ws'
const token = process.env.TOKEN || 'invalid-token'

let settled = false
const t = setTimeout(() => {
  if (!settled) {
    console.error('timeout waiting for failure')
    process.exit(2)
  }
}, 8000)

const ws = new WebSocket(url, ['bearer', token])
ws.once('open', () => {
  settled = true
  console.error('unexpected success')
  process.exit(1)
})
ws.once('error', () => {
  settled = true
  clearTimeout(t)
  console.log('expected failure')
  process.exit(0)
})

