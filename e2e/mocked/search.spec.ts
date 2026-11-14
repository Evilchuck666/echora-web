import { expect, test } from '../support/fixtures.ts'

test.beforeEach(async ({ signIn }) => signIn())

const searchBox = (page: import('@playwright/test').Page) => page.getByRole('searchbox', { name: 'Search the library' })

test('typing opens the results: artists, albums and tracks', async ({ page }) => {
  await searchBox(page).fill('accept')

  await expect(page).toHaveURL('/search?q=accept')
  await expect(page.getByRole('heading', { name: 'Results for “accept”' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Artists' }).getByRole('link')).toHaveText(['Accept'])
  await expect(page.getByRole('region', { name: 'Albums' }).getByRole('listitem')).toHaveCount(2)
  // Folded to the best 5 of 9 tracks.
  const tracks = page.getByRole('region', { name: 'Tracks' })
  await expect(tracks.getByRole('listitem')).toHaveCount(5)
  await tracks.getByRole('button', { name: 'Show all (9)' }).click()
  await expect(tracks.getByRole('listitem')).toHaveCount(9)
})

test('accents and word order are ignored', async ({ page }) => {
  await searchBox(page).fill('spades MOTORHEAD')

  await expect(page.getByRole('region', { name: 'Albums' }).getByRole('link')).toHaveText([/Ace of Spades/])
  await expect(page.getByRole('region', { name: 'Artists' })).toHaveCount(0)
})

test('nothing found says so', async ({ page }) => {
  await searchBox(page).fill('zzqqxx')

  await expect(page.getByText('Nothing in the library matches “zzqqxx”.')).toBeVisible()
})

test('a result opens, and Back returns to the results', async ({ page }) => {
  await searchBox(page).fill('leatherboys')
  await page.getByRole('region', { name: 'Tracks' }).getByRole('link', { name: 'London Leatherboys' }).click()

  await expect(page.getByRole('heading', { name: 'Balls to the Wall' })).toBeVisible()
  await expect(searchBox(page)).toHaveValue('')

  await page.goBack()
  await expect(page).toHaveURL('/search?q=leatherboys')
  await expect(searchBox(page)).toHaveValue('leatherboys')
  await page.goBack()
  await expect(page).toHaveURL('/')
})

test('the × button empties the field, and leaves the results for the page before', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: 'Artists' }).click()
  await page.getByRole('link', { name: 'Accept', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Accept' })).toBeVisible()
  const artistUrl = page.url()
  const clear = page.getByRole('button', { name: 'Clear the search' })
  await expect(clear).toHaveCount(0)

  await searchBox(page).fill('killer')
  await expect(page).toHaveURL('/search?q=killer')
  await clear.click()

  await expect(page).toHaveURL(artistUrl)
  await expect(searchBox(page)).toHaveValue('')
  await expect(searchBox(page)).toBeFocused()
  await expect(clear).toHaveCount(0)
})

test('deleting the text leaves the results too', async ({ page }) => {
  await searchBox(page).fill('killer')
  await expect(page).toHaveURL('/search?q=killer')

  await searchBox(page).fill('')

  await expect(page).toHaveURL('/')
})

for (const empty of ['/search', '/search?q=', '/search?q=%20%20']) {
  test(`${empty} is never shown: it is replaced by the home page`, async ({ context }) => {
    const tab = await context.newPage()
    await tab.goto(empty)

    await expect(tab).toHaveURL('/')
    expect(await tab.evaluate(() => (history.state as { idx?: number } | null)?.idx)).toBe(0)
  })
}

test('"/" focuses the search, Enter searches at once', async ({ page }) => {
  await page.getByRole('heading', { name: 'Recently added' }).click()
  await page.keyboard.press('/')
  await expect(searchBox(page)).toBeFocused()

  await page.keyboard.type('cooper')
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/search?q=cooper', { timeout: 250 })
})
