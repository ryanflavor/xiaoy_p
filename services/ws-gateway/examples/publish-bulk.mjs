import { connect, StringCodec } from 'nats'

const url = process.env.NATS_URL || 'nats://localhost:4222'
const subj = process.env.SUBJECT || 'xy.md.tick.demo'
const n = Number(process.env.N || '100')
const size = Number(process.env.SIZE || '1024') // bytes per message

const payload = 'x'.repeat(size)
const nc = await connect({ servers: url })
const sc = StringCodec()
for (let i=0;i<n;i++) {
  await nc.publish(subj, sc.encode(payload))
}
await nc.flush()
await nc.close()
console.log(`published ${n} msgs to ${subj} size=${size}`)

