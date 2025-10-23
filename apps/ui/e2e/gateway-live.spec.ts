import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

test.use({ video: 'on' })

function startGateway(opts: { port: number, whitelist: string, jwkPubPath: string, natsUrl: string }) {
  const env = {
    ...process.env,
    PORT: String(opts.port),
    HOST: '127.0.0.1',
    WS_SUBJECT_WHITELIST: opts.whitelist,
    JWT_PUBLIC_KEY: opts.jwkPubPath,
    NATS_URLS: opts.natsUrl,
    LOG_LEVEL: 'info',
  }
  const child = spawn('bash', ['-lc', 'npm --prefix services/ws-gateway run -s dev'], { env })
  const ready = new Promise<void>((resolve) => {
    const onData = (b: Buffer) => { if (b.toString().includes('server listening')) resolve() }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
  })
  return { child, ready }
}

async function waitHealth(url: string, expectTrue: boolean, timeoutMs = 10_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url)
      const j: any = await res.json()
      if (!!j.natsConnected === expectTrue) return j
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('healthz did not reach expected state')
}

test('Gateway Live E2E: subscribe and receive message', async ({ page }) => {
  // Preconditions: docker NATS exposed at 127.0.0.1:4222 (run once outside test)
  // Token and public key exist (generated earlier)
  const tokenPath = 'services/ws-gateway/.demo_token.txt'
  const pubKeyPath = 'services/ws-gateway/.demo_pub.pem'
  const token = readFileSync(tokenPath, 'utf8').trim()

  const gw = startGateway({ port: 18080, whitelist: 'xy.md.>', jwkPubPath: pubKeyPath, natsUrl: 'nats://127.0.0.1:4222' })
  await gw.ready
  await waitHealth('http://127.0.0.1:18080/healthz', true)

  const subject = 'xy.md.demo'
  const payload = `ui-e2e-${Date.now()}`
  const url = `http://localhost:5174/demo/index.html?url=ws://127.0.0.1:18080/ws&token=${encodeURIComponent(token)}`

  await page.goto(url)
  // Ensure connected
  await page.getByRole('button', { name: '连接' }).click()
  await page.getByRole('button', { name: '健康' }).click()
  // Retry a few times in case gateway just started
  let ok = false
  for (let i=0;i<10;i++) {
    const t = await page.locator('#health').textContent()
    if (t && t.includes('"connected": true')) { ok = true; break }
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '健康' }).click()
  }
  expect(ok).toBeTruthy()
  // Subscribe
  await page.locator('#subTopic').fill(subject)
  await page.getByRole('button', { name: '订阅' }).click()
  await expect(page.locator('#out')).toContainText(`ack: subscribe ${subject}`)

  // Publish via gateway helper script
  await new Promise<void>((resolve, reject) => {
    const pub = spawn('bash', ['-lc', `SUBJECT=${subject} node services/ws-gateway/examples/publish.mjs "${payload}"`])
    pub.on('exit', (code) => code === 0 ? resolve() : reject(new Error('publish failed')))
  })

  // Expect the message to arrive via WS → SharedWorker → page
  await expect(page.locator('#out')).toContainText(payload)

  // Cleanup gateway
  try { gw.child.kill() } catch {}
})
// @live Requires live gateway stack
const LIVE = process.env.E2E_LIVE === '1'
test.skip(!LIVE, 'Requires live gateway')
