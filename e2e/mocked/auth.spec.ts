import { expect, test } from '../support/fixtures.ts'
import { PASSWORD, USERNAME } from '../support/mock-api.ts'

test('a signed-out visitor is sent to the login page', async ({ page, api: _api }) => {
  await page.goto('/albums/whatever')

  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('a wrong password says so', async ({ page, api: _api }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill(USERNAME)
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toHaveText('Wrong username or password')
})

test('signing in shows the library and the account, and survives a reload', async ({ page, signIn }) => {
  await signIn()

  await expect(page.getByRole('banner')).toContainText(USERNAME)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible()
})

test('after signing in, the app goes back to the page that asked for it', async ({ page, api: _api }) => {
  await page.goto('/search?q=accept')
  await expect(page).toHaveURL('/login')
  await page.getByLabel('Username').fill(USERNAME)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/search?q=accept')
})

test('other tabs follow signing in and out', async ({ context, page, signIn, api }) => {
  const other = await context.newPage()
  await other.goto('/')
  await expect(other).toHaveURL('/login')

  await signIn(page)
  await expect(other.getByRole('heading', { name: 'Artists' })).toBeVisible()

  const refreshToken = await page.evaluate(() => JSON.parse(localStorage.getItem('echora.session')!).refreshToken)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')
  await expect(other).toHaveURL('/login')
  expect(api.logouts).toEqual([refreshToken])
})

test('two tabs with an expired JWT refresh it once', async ({ context, page, signIn, api }) => {
  await signIn(page)
  const other = await context.newPage()
  await other.goto('/')
  await expect(other.getByRole('heading', { name: 'Artists' })).toBeVisible()

  // Both tabs find a JWT that expired (exp 0) and reload at the same time.
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('echora.session')!)
    localStorage.setItem('echora.session', JSON.stringify({ ...session, token: 'x.eyJleHAiOjB9.x' }))
  })
  await Promise.all([page.reload(), other.reload()])

  await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible()
  await expect(other.getByRole('heading', { name: 'Artists' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Accept' })).toBeVisible()
  await expect(other.getByRole('link', { name: 'Accept' })).toBeVisible()
  expect(api.refreshes).toHaveLength(1)
})

test('a JWT the API rejects is refreshed and the request sent again', async ({ page, signIn, api }) => {
  await signIn()
  api.rejectAccessTokens()

  await page.reload()

  await expect(page.getByRole('link', { name: 'Accept' })).toBeVisible()
  expect(api.refreshes).toHaveLength(1)
})
