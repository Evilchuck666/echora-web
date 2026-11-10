import { test as base, expect, type Page } from '@playwright/test'
import { MockApi, PASSWORD, USERNAME, type MockApiOptions } from './mock-api.ts'

interface Fixtures {
  /** Options of the mock API; override per file or test with test.use({ apiOptions: ... }). */
  apiOptions: MockApiOptions
  /** The mock API, installed on the browser context before the page loads. */
  api: MockApi
  /** Signs in through the login page and waits for the artists. */
  signIn: (page?: Page) => Promise<void>
}

export const test = base.extend<Fixtures>({
  apiOptions: [{}, { option: true }],
  // The second argument hands the fixture to the test (Playwright calls it "use"; not a React hook).
  api: async ({ context, apiOptions }, provide) => {
    const api = new MockApi(apiOptions)
    await api.install(context)
    await provide(api)
  },
  signIn: async ({ page: defaultPage, api: _api }, provide) => {
    await provide(async (page = defaultPage) => {
      await page.goto('/login')
      await page.getByLabel('Username').fill(USERNAME)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible()
    })
  },
})

export { expect }
