import { expect, test } from '../support/fixtures.ts'

test.describe('browsing', () => {
  test.beforeEach(async ({ signIn }) => signIn())

  test('artists show their photo, or their initial', async ({ page }) => {
    const list = page.getByRole('main').getByRole('list')

    await expect(page.getByText('3 artists')).toBeVisible()
    await expect(list.getByRole('link')).toHaveText(['Accept', 'Alice Cooper', 'MMotörhead'])
    await expect(list.getByRole('link', { name: 'Accept' }).locator('img')).toHaveJSProperty('naturalWidth', 300)
    await expect(list.getByRole('link', { name: /Motörhead/ }).locator('img')).toHaveCount(0)
  })

  test('from an artist to an album and back', async ({ page }) => {
    await page.getByRole('link', { name: 'Accept' }).click()

    await expect(page.getByRole('heading', { name: 'Accept' })).toBeVisible()
    await expect(page.getByText('2 albums')).toBeVisible()
    // By year.
    await expect(page.getByRole('main').getByRole('list').getByRole('link')).toHaveText([/^Breaker1981$/, /^Balls to the Wall1983$/])

    await page.getByRole('link', { name: /Balls to the Wall/ }).click()
    await expect(page.getByRole('heading', { name: 'Balls to the Wall' })).toBeVisible()
    await expect(page.getByRole('main').locator('header')).toContainText('Accept · 1983 · 6 tracks · 1:12')
    await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(6)
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link')).toHaveText(['Artists', 'Accept'])

    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Accept' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Artists' }).click()
    await expect(page.getByText('3 artists')).toBeVisible()
  })

  test('unknown artists and albums say so', async ({ page }) => {
    await page.goto('/artists/00000000-0000-4000-8000-999999999999')
    await expect(page.getByText("This artist isn't in the library.")).toBeVisible()

    await page.goto('/albums/00000000-0000-4000-8000-999999999999')
    await expect(page.getByText("This album isn't in the library.")).toBeVisible()
  })

  test('an unknown page says so', async ({ page }) => {
    await page.goto('/nowhere')

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
})

test.describe('infinite scroll', () => {
  // 70 artists in pages of 30; page 2 fails on the first try and on both automatic retries.
  test.use({ apiOptions: { extraArtists: 67, failArtistsPage: { page: 2, times: 3 } } })

  test('loads every page while scrolling, and offers a retry when one fails', async ({ page, signIn, api }) => {
    await signIn()
    const cards = page.getByRole('main').getByRole('list').getByRole('link')
    await expect(page.getByText('70 artists')).toBeVisible()
    await expect(cards).toHaveCount(30)

    await page.mouse.wheel(0, 10_000)
    const retry = page.getByRole('button', { name: "Couldn't load more. Try again" })
    await expect(retry).toBeVisible({ timeout: 15_000 })
    await expect(cards).toHaveCount(30)

    await retry.click()
    await expect(async () => {
      await page.mouse.wheel(0, 10_000)
      await expect(cards).toHaveCount(70, { timeout: 1000 })
    }).toPass()
    await expect(cards.last()).toHaveText(/Motörhead/)

    const pages = api.requests.filter((r) => r.startsWith('GET /api/artists?')).map((r) => new URL(r.split(' ')[1], 'http://x').searchParams.get('page'))
    expect(pages).toEqual(['1', '2', '2', '2', '2', '3'])
  })
})
