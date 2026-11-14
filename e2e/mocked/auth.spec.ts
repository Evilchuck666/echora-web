import { expect, fillSignIn, signOut, test } from '../support/fixtures.ts'
import { NAME, PASSWORD, USERNAME } from '../support/mock-api.ts'

test('a signed-out visitor is sent to the login page', async ({ page, api: _api }) => {
  await page.goto('/albums/whatever')

  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('a wrong password says so', async ({ page, api: _api }) => {
  await page.goto('/login')
  await fillSignIn(page, USERNAME, 'wrong')

  await expect(page.getByRole('alert')).toHaveText('Wrong email, username or password')
})

test('signing in shows the library and the name of the account, and survives a reload', async ({ page, signIn }) => {
  await signIn()

  await expect(page.getByRole('banner')).toContainText(NAME)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()
})

test('after signing in, the app goes back to the page that asked for it', async ({ page, api: _api }) => {
  await page.goto('/search?q=accept')
  await expect(page).toHaveURL('/login')
  await fillSignIn(page, USERNAME, PASSWORD)

  await expect(page).toHaveURL('/search?q=accept')
})

test('other tabs follow signing in and out', async ({ context, page, signIn, api }) => {
  const other = await context.newPage()
  await other.goto('/')
  await expect(other).toHaveURL('/login')

  await signIn(page)
  await expect(other.getByRole('heading', { name: 'Recently added' })).toBeVisible()

  const refreshToken = await page.evaluate(() => JSON.parse(localStorage.getItem('echora.session')!).refreshToken)
  await signOut(page)
  await expect(page).toHaveURL('/login')
  await expect(other).toHaveURL('/login')
  expect(api.logouts).toEqual([refreshToken])
})

test('two tabs with an expired JWT refresh it once', async ({ context, page, signIn, api }) => {
  await signIn(page)
  const other = await context.newPage()
  await other.goto('/')
  await expect(other.getByRole('heading', { name: 'Recently added' })).toBeVisible()

  // Both tabs find a JWT that expired (exp 0) and reload at the same time.
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('echora.session')!)
    localStorage.setItem('echora.session', JSON.stringify({ ...session, token: 'x.eyJleHAiOjB9.x' }))
  })
  await Promise.all([page.reload(), other.reload()])

  await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()
  await expect(other.getByRole('heading', { name: 'Recently added' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: /Ace of Spades/ }).first()).toBeVisible()
  await expect(other.getByRole('main').getByRole('link', { name: /Ace of Spades/ }).first()).toBeVisible()
  expect(api.refreshes).toHaveLength(1)
})

test('a JWT the API rejects is refreshed and the request sent again', async ({ page, signIn, api }) => {
  await signIn()
  // Wait for every request of the sign-in (the header's account), so none of them meets the rejected JWT.
  await expect(page.getByRole('banner')).toContainText(NAME)
  api.rejectAccessTokens()

  await page.reload()

  await expect(page.getByRole('main').getByRole('link', { name: /Ace of Spades/ }).first()).toBeVisible()
  expect(api.refreshes).toHaveLength(1)
})

test('a refresh whose response was lost does not sign out', async ({ page, signIn, api }) => {
  await signIn()
  await expect(page.getByRole('banner')).toContainText(NAME)
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('echora.session')!)
    localStorage.setItem('echora.session', JSON.stringify({ ...session, token: 'x.eyJleHAiOjB9.x' }))
  })
  // The API rotates the refresh token, but the new pair never arrives: the client still holds the spent one.
  api.loseNextRefreshResponse = true

  await page.reload()

  await expect(page.getByRole('main').getByRole('link', { name: /Ace of Spades/ }).first()).toBeVisible()
  await expect(page.getByRole('banner')).toContainText(NAME)
  // The spent token was presented again, and the API's grace period answered it.
  expect(api.refreshes).toHaveLength(2)
  expect(api.refreshes[0]).toBe(api.refreshes[1])
})

test('after 5 wrong passwords, sign-ins are refused for a while, even the right one', async ({ page, api: _api }) => {
  await page.goto('/login')
  for (let attempt = 1; attempt <= 5; attempt++) {
    await fillSignIn(page, USERNAME, 'wrong')
    await expect(page.getByRole('alert')).toHaveText('Wrong email, username or password')
  }

  await fillSignIn(page, USERNAME, PASSWORD)

  await expect(page.getByRole('alert')).toHaveText('Too many failed sign-in attempts: try again in 15 minutes.')
  await expect(page).toHaveURL('/login')
})
