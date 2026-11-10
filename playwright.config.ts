import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Credentials of the account the live tests sign in with (e2e/.env, git-ignored; see e2e/.env.example).
if (existsSync('e2e/.env')) {
  process.loadEnvFile('e2e/.env')
}

const PORT = 5179

// A deployed Echora (e.g. https://music.example.com) to run the live tests against, instead of Vite and the local API.
const deployed = process.env.ECHORA_E2E_BASE_URL

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    // The app against a mock API (e2e/support/mock-api.ts): no server needed, runs in CI.
    { name: 'mocked', testDir: 'e2e/mocked' },
    // The app against the real API (../Echora on https://localhost) and its library: run by hand, see e2e/live.
    { name: 'live', testDir: 'e2e/live', use: { ignoreHTTPSErrors: true, ...(deployed ? { baseURL: deployed } : {}) } },
  ],
  webServer: deployed
    ? undefined
    : {
        command: `bunx vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
      },
})
