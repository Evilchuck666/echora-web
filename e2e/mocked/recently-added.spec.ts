import { expect, test } from '../support/fixtures.ts'

test.beforeEach(async ({ signIn }) => signIn())

test('the home page lists the albums added last, the latest first', async ({ page }) => {
  await expect(page).toHaveURL('/')
  const library = page.getByRole('navigation', { name: 'Library' })
  await expect(library.getByRole('link', { name: 'Recently added' })).toHaveAttribute('aria-current', 'page')

  const albums = page.getByRole('main').getByRole('listitem')
  // Not the library's order (Breaker, Balls to the Wall, Killer, Ace of Spades): when each was added.
  await expect(albums).toHaveText([/^Ace of Spades/, /^Killer/, /^Breaker/, /^Balls to the Wall/])
  await expect(albums.first()).toContainText('Added yesterday')
  await expect(albums.nth(1)).toContainText('Added 3 days ago')
  // Only albums: the artists have their own page.
  await expect(page.getByRole('main').getByRole('heading', { name: 'Artists' })).toHaveCount(0)

  await albums.first().getByRole('link', { name: /Ace of Spades/ }).click()
  await expect(page.getByRole('heading', { name: 'Ace of Spades', level: 1 })).toBeVisible()
  // The logo comes back to it.
  await page.getByRole('banner').getByRole('link', { name: 'Echora' }).click()
  await expect(page.getByRole('heading', { name: 'Recently added', level: 1 })).toBeVisible()
})

test('Artists is a page of its own, and only artists', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: 'Artists' }).click()
  await expect(page).toHaveURL('/artists')
  await expect(page.getByRole('heading', { name: 'Artists', level: 1 })).toBeVisible()
  await expect(page.getByRole('main').getByRole('listitem')).toHaveText(['Accept', 'Alice Cooper', 'MMotörhead'])
})

test('a recently added album plays from its card', async ({ page }) => {
  await page.getByRole('main').getByRole('button', { name: 'More options for Killer' }).click()
  await page.getByRole('menuitem', { name: 'Play next' }).click()
  await expect(page.getByRole('region', { name: 'Player' }).getByRole('link').first()).toHaveText('Under My Wheels')
})
