import { readFileSync } from 'node:fs'
import { WebSocket } from 'ws'

const token = (process.env.TOKEN || readFileSync(new URL('../.demo_token.txt', import.meta.url)).toString()).trim()
const url = process.env.WS_URL || 'ws://localhost:8080/ws'
const subjects = (process.env.SUBJECTS || 'xy.md.tick.demo').split(',')

const ws = new WebSocket(url, ['bearer', token])

ws.on('open', () => {
  console.log('ws open, subscribing', subjects)
  ws.send(JSON.stringify({ type: 'subscribe', subjects }))
})

ws.on('message', (data) => {
  console.log('message:', data.toString())
})

ws.on('error', (err) => {
  console.error('ws error', err)
})

const DURATION = Number(process.env.DURATION_SEC || '15')
setTimeout(() => {
  console.log('closing')
  ws.close()
}, DURATION * 1000)
