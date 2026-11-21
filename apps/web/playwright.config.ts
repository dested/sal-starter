import { availableParallelism } from 'node:os'
import { defineConfig, devices } from '@playwright/test'

// Flows (`*.flow.spec.ts`, fixtures in e2e/flow.ts) run on the production
// build: `bun run test:flows` builds first. Each worker starts its own server
// on a free port against its own clone of the test template (test/db.ts), so
// no flow shares a port, a server or rows with another run, and no flow may
// depend on another's order. Every flow runs in both projects: desktop and a
// phone. e2e/coverage.ts fails a full run that left a route unvisited in either.
const strict = Boolean(process.env.CI) || process.env.GATE === '1'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.flow.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  // Each worker is a browser plus an app server; past four they mostly wait on each other.
  workers: Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2))),
  forbidOnly: strict,
  retries: 0,
  reporter: [[process.env.CI ? 'github' : 'list'], ['./e2e/coverage.ts']],
  // Screenshots are pixel-compared per project; baselines live in
  // e2e/__screenshots__/<project>/ and are committed. They are OS/font specific:
  // regenerate on the platform the gate runs on (`bun run test:flows:update`).
  snapshotPathTemplate: 'e2e/__screenshots__/{projectName}/{testFileName}/{arg}{ext}',
  // A mostly white page differs from a different page by under 2% of pixels,
  // so the tolerance only absorbs anti-aliasing noise (0.2% here); 2% passed
  // the October landing page's baseline against a rewritten home.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002 },
  },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
