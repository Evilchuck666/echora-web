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
  await page.getByLabel('Email or username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()
}

test('browse to an album and play it', async ({ page }) => {
  await signIn(page)
  await page.goto('/artists')
  const artists = page.getByRole('main').getByRole('list', { name: 'Artists' }).getByRole('link')
  await expect(artists.first()).toBeVisible()

  await artists.first().click()
  const albums = page.getByRole('main').getByRole('list').getByRole('link')
  await albums.first().click()
  // The album page's label (shown in capitals); not the sidebar's Albums, nor the artist's "2 albums".
  await expect(page.getByRole('main').getByText('Album', { exact: true })).toBeVisible()

  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  const player = page.getByRole('region', { name: 'Player' })
  const position = player.getByRole('slider', { name: 'Position in the track' })
  await expect(async () => expect(Number(await position.inputValue())).toBeGreaterThan(2)).toPass({ timeout: 20_000 })
  await player.getByRole('button', { name: 'Pause' }).click()
})

test('the search finds an artist by its name', async ({ page }) => {
  await signIn(page)
  await page.goto('/artists')
  // The name under the photo (the card also holds the artist's initial when there is no photo).
  const name = (await page.getByRole('main').getByRole('list', { name: 'Artists' }).getByRole('link').first().locator('p').innerText()).trim()

  await page.getByRole('searchbox', { name: 'Search the library' }).fill(name)

  await expect(page.getByRole('region', { name: 'Artists' }).getByRole('link', { name, exact: true })).toBeVisible()
})

test('the profile shows the account signed in, and changes nothing until asked', async ({ page }) => {
  await signIn(page)
  const account = page.getByRole('banner').getByRole('button', { name: /^Account: / })
  const name = ((await account.getAttribute('aria-label')) ?? '').replace(/^Account: /, '')

  await account.click()
  await page.getByRole('menuitem', { name: 'Profile' }).click()

  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name)
  // Signed in with the username or the email: one of the two fields holds it.
  const fields = [await page.getByLabel('Username', { exact: true }).inputValue(), await page.getByLabel('Email', { exact: true }).inputValue()]
  expect(fields.map((field) => field.toLowerCase())).toContain(username.toLowerCase())
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('signing out invalidates the refresh token on the server', async ({ page, request }) => {
  await signIn(page)
  const refreshToken = await page.evaluate(() => JSON.parse(localStorage.getItem('echora.session')!).refreshToken as string)

  await page.getByRole('banner').getByRole('button', { name: /^Account/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')

  const response = await request.post(`${API}/api/token/refresh`, { data: { refresh_token: refreshToken }, ignoreHTTPSErrors: true })
  expect(response.status()).toBe(401)
})

test('a refresh whose response was lost does not sign out (the API grace period)', async ({ page }) => {
  await signIn(page)
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('echora.session')!)
    localStorage.setItem('echora.session', JSON.stringify({ ...session, token: 'x.eyJleHAiOjB9.x' }))
  })
  // The first refresh reaches the API, which rotates the token, but its response never reaches the page.
  let lost = false
  await page.route(`${API}/api/token/refresh`, async (route) => {
    if (lost) {
      return route.continue()
    }
    lost = true
    await route.fetch()
    await route.abort('connectionreset')
  })

  await page.reload()

  await expect(page.getByRole('main').getByRole('link').first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()
  expect(lost).toBe(true)
})
