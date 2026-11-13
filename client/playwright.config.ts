import { defineConfig, devices } from '@playwright/test'

// Capture runs on its own ports so it can use the isolated E2E database without
// interrupting the developer's local app on :5173/:3001.
const apiPort = process.env.CI ? 3002 : 3001
const webPort = process.env.CI ? 5174 : 5173

/**
 * E2E harness for TREK's critical user flows (FE7).
 *
 * Two web servers are orchestrated: the Nest backend against an
 * isolated throwaway SQLite DB (e2e/server-launch.mjs sets TREK_DB_FILE + seeds a
 * known admin), and Vite proxies /api, /uploads,
 * /ws to the backend. Tests run serially against one worker so they share the
 * single seeded database deterministically. CI capture uses :3002/:5174 to avoid
 * disrupting a developer server on :3001/:5173.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Unauthenticated flows (login, register, public share) — no stored session.
    { name: 'public', testMatch: /\.public\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    // One-time login that persists a session for the authenticated flows.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // Demo trip + addons — shared by app, visual, member, and screenshot projects.
    {
      name: 'seed',
      testMatch: /seed\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.tmp/state.json' },
      dependencies: ['setup'],
    },
    // Member session (seeded trip collaborator) for permission tests.
    {
      name: 'member-setup',
      testMatch: /member\.setup\.ts/,
      dependencies: ['seed'],
    },
    {
      name: 'app',
      testMatch: /\.spec\.ts/,
      testIgnore: /(\.public\.spec\.ts|auth\.setup\.ts|member\.setup\.ts|visual-theme\.spec\.ts|mobile\.spec\.ts)/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.tmp/state.json' },
      dependencies: ['seed'],
    },
    {
      name: 'member',
      testMatch: /member\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.tmp/member-state.json' },
      dependencies: ['member-setup'],
    },
    {
      name: 'visual',
      testMatch: /visual-theme\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.tmp/state.json',
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ['seed'],
      snapshotPathTemplate: '{testDir}/visual-snapshots/{testFilePath}/{arg}{ext}',
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        storageState: 'e2e/.tmp/state.json',
      },
      dependencies: ['seed'],
    },
    // Documentation screenshots (`npm run shots`). Excluded from the normal e2e
    // run by its own testMatch — these capture artwork for wiki/assets/.
    {
      name: 'screenshots',
      testMatch: /\.shot\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.tmp/state.json',
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      },
      dependencies: ['seed'],
    },
    {
      name: 'screenshots-mobile',
      testMatch: /\.mshot\.ts/,
      use: {
        ...devices['Pixel 7'],
        storageState: 'e2e/.tmp/state.json',
      },
      dependencies: ['seed'],
    },
  ],
  webServer: [
    {
      command: 'node e2e/server-launch.mjs',
      port: apiPort,
      env: { TREK_E2E_PORT: String(apiPort), HOST: '127.0.0.1' },
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'VITE_E2E=1 npm run dev',
      port: webPort,
      env: { VITE_PORT: String(webPort), TREK_API_PORT: String(apiPort), VITE_E2E: '1', HOST: '127.0.0.1' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
