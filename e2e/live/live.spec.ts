import { expect, test, type Page } from '@playwright/test'

// Against the real API (../Echora, https://localhost) and whatever library it holds, so nothing here depends on
// particular artists. Signs in with ECHORA_E2E_USERNAME and ECHORA_E2E_PASSWORD (e2e/.env, see e2e/.env.example).
// With ECHORA_E2E_BASE_URL, against a deployed Echora instead, whose API is on the same origin.

const API = process.env.ECHORA_E2E_BASE_URL ?? 'https://localhost'
const username = process.env.ECHORA_E2E_USERNAME ?? ''
const password = process.env.ECHORA_E2E_PASSWORD ?? ''

test.skip(!username || !password, 'Set ECHORA_E2E_USERNAME and ECHORA_E2E_PASSWORD in e2e/.env')

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible()
}

test('browse to an album and play it', async ({ page }) => {
  await signIn(page)
  const artists = page.getByRole('main').getByRole('list').getByRole('link')
  await expect(artists.first()).toBeVisible()

  await artists.first().click()
  const albums = page.getByRole('main').getByRole('list').getByRole('link')
  await albums.first().click()
  await expect(page.getByText('ALBUM')).toBeVisible()

  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  const player = page.getByRole('region', { name: 'Player' })
  const position = player.getByRole('slider', { name: 'Position in the track' })
  await expect(async () => expect(Number(await position.inputValue())).toBeGreaterThan(2)).toPass({ timeout: 20_000 })
  await player.getByRole('button', { name: 'Pause' }).click()
})

test('the search finds an artist by its name', async ({ page }) => {
  await signIn(page)
  // The name under the photo (the card also holds the artist's initial when there is no photo).
  const name = (await page.getByRole('main').getByRole('list').getByRole('link').first().locator('p').innerText()).trim()

  await page.getByRole('searchbox', { name: 'Search the library' }).fill(name)

  await expect(page.getByRole('region', { name: 'Artists' }).getByRole('link', { name, exact: true })).toBeVisible()
})

test('signing out invalidates the refresh token on the server', async ({ page, request }) => {
  await signIn(page)
  const refreshToken = await page.evaluate(() => JSON.parse(localStorage.getItem('echora.session')!).refreshToken as string)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')

  const response = await request.post(`${API}/api/token/refresh`, { data: { refresh_token: refreshToken }, ignoreHTTPSErrors: true })
  expect(response.status()).toBe(401)
})
