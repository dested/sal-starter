import { defineConfig, devices } from '@playwright/test'
import { E2E_DATABASE_URL, E2E_PORT } from './e2e/db'

// Flows run against their own database on their own port (project.json
// apiPort + 3) so they never touch your dev DB, your dev server or another
// fork's. `bun run test:flows` boots the app itself (see `webServer`) and
// `global-setup.ts` clones a fresh database from the migrated test template
// (test/db.ts) so screenshots are deterministic. Under gate (GATE=1) the
// template is gate's DATABASE_URL and an existing server is never reused.
const PORT = E2E_PORT
const baseURL = `http://localhost:${PORT}`
const strict = Boolean(process.env.CI) || process.env.GATE === '1'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: strict,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Screenshots are pixel-compared; baselines live in e2e/__screenshots__ and
  // are committed. They are OS/font specific — regenerate on the same platform
  // your CI uses (`bun run test:e2e:update`).
  snapshotPathTemplate: 'e2e/__screenshots__/{testFileName}/{arg}{ext}',
  // A mostly white page differs from a different page by under 2% of pixels,
  // so the tolerance only absorbs anti-aliasing noise (0.2% here); 2% passed
  // the October landing page's baseline against a rewritten home.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002 },
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun server.ts',
    // Probe over IPv6 loopback: under WSL's mirrored networking a connect to a
    // closed 127.0.0.1 port is dropped, not refused, so the "already running?"
    // check hung for ~2 min (the TCP SYN timeout) before every run. The server
    // listens on :: (both stacks); the browser still uses `baseURL`. A static
    // file, not /healthz: Playwright starts the server before global-setup
    // clones the flows' database, so a DB ping would never pass.
    url: `http://[::1]:${PORT}/robots.txt`,
    reuseExistingServer: !strict,
    timeout: 60_000,
    stdout: 'pipe',
    env: {
      PORT: String(PORT),
      NODE_ENV: 'development',
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: 'e2e-secret-at-least-32-characters-long!!',
      BETTER_AUTH_URL: baseURL,
    },
  },
})
