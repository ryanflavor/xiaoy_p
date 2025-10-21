import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'apps/ui/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    baseURL: 'http://localhost:5174',
  },
  // Reuse an existing demo server if the user ran `npm run demo`.
  // Playwright will skip starting the command when the URL is already reachable.
  webServer: {
    command: 'PORT=5175 node apps/ui/demo/server.mjs',
    url: 'http://localhost:5174/demo/index.html',
    reuseExistingServer: true,
    timeout: 20_000,
  },
})
