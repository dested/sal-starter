import { defineConfig, devices } from '@playwright/test'
import { E2E_DATABASE_URL } from './e2e/db'

// E2E runs against an isolated test database on a dedicated port so it never
// touches your dev DB or dev server. `bun run test:e2e` boots the app itself
// (see `webServer`) and `global-setup.ts` applies migrations (`migrate deploy`)
// and truncates the test DB first so screenshots are deterministic. Override the
// DB with E2E_DATABASE_URL (its name must end in `_test`).
const PORT = 3100
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Screenshots are pixel-compared; baselines live in e2e/__screenshots__ and
  // are committed. They are OS/font specific — regenerate on the same platform
  // your CI uses (`bun run test:e2e:update`).
  snapshotPathTemplate: 'e2e/__screenshots__/{testFileName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun server.ts',
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
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
