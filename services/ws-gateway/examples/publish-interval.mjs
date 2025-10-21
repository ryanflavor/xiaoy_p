import { connect, StringCodec } from 'nats'

const url = process.env.NATS_URL || 'nats://localhost:4222'
const subj = process.env.SUBJECT || 'xy.md.tick.demo'
const intervalMs = Math.max(1, Number(process.env.INTERVAL_MS || '1'))

const nc = await connect({ servers: url })
const sc = StringCodec()

let seq = 0
let lastLog = Date.now()
let sent = 0

const timer = setInterval(async () => {
  try {
    const payload = {
      ts_server: Date.now(),
      seq: seq++,
      text: `demo-msg-${Date.now()}`,
    }
    await nc.publish(subj, sc.encode(JSON.stringify(payload)))
    sent++
    const now = Date.now()
    if (now - lastLog >= 1000) {
      // Lightweight progress log each second
      console.log(`published ${sent} msgs in last ${Math.round((now - lastLog)/1000)}s (interval=${intervalMs}ms) to ${subj}`)
      lastLog = now
      sent = 0
    }
  } catch (e) {
    console.error('publish error', e)
  }
}, intervalMs)

process.on('SIGINT', async () => {
  clearInterval(timer)
  await nc.flush()
  await nc.close()
  process.exit(0)
})

