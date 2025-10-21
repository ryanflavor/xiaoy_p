import { connect, StringCodec } from 'nats'

const url = process.env.NATS_URL || 'nats://localhost:4222'
const subj = process.env.SUBJECT || 'xy.md.tick.demo'
const msg = process.argv[2] || `hello ${new Date().toISOString()}`

const nc = await connect({ servers: url })
const sc = StringCodec()
await nc.publish(subj, sc.encode(msg))
await nc.flush()
console.log('published', subj, msg)
await nc.close()

