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
      await fillSignIn(page, USERNAME, PASSWORD)
      await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()
    })
  },
})

/** Fills the sign-in form (already shown) with an email or a username, and sends it. */
export async function fillSignIn(page: Page, identifier: string, password: string): Promise<void> {
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** The header's account button: picture and name. */
export const accountButton = (page: Page) => page.getByRole('banner').getByRole('button', { name: /^Account/ })

/** Signs out from the header's account menu. */
export async function signOut(page: Page): Promise<void> {
  await accountButton(page).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
}

export { expect }
