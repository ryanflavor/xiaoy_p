import { connect, StringCodec } from 'nats'

const url = process.env.NATS_URL || 'nats://localhost:4222'
const subj = process.env.SUBJECT || 'xy.md.tick.demo'
const text = process.argv[2] || `demo-msg-${Date.now()}`

const nc = await connect({ servers: url })
const sc = StringCodec()

// Include a server-side timestamp to enable e2e latency estimation on UI
const payload = {
  ts_server: Date.now(),
  seq: Number(process.env.SEQ || '0'),
  text,
}

await nc.publish(subj, sc.encode(JSON.stringify(payload)))
await nc.flush()
console.log('published', subj, payload)
await nc.close()
