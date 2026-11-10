import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'

const player = (page: Page) => page.getByRole('region', { name: 'Player' })
const heart = (page: Page, name: string) => page.getByRole('main').getByRole('button', { name: `Favourite ${name}`, exact: true })
const library = (page: Page) => page.getByRole('navigation', { name: 'Library' })

async function openAlbum(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill(title)
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

test.beforeEach(async ({ signIn }) => signIn())

test('a track becomes a favourite from its album, and the favourites page lists it', async ({ page, api }) => {
  await openAlbum(page, 'Killer')

  await heart(page, 'Be My Lover').click()

  await expect(heart(page, 'Be My Lover')).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => api.favourites.track.length).toBe(1)

  await library(page).getByRole('link', { name: 'Favourites' }).click()
  await page.getByRole('navigation', { name: 'Favourites' }).getByRole('link', { name: 'Tracks' }).click()
  await expect(page.getByRole('heading', { name: 'Favourites' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Be My Lover' })).toBeVisible()
  await expect(heart(page, 'Be My Lover')).toHaveAttribute('aria-pressed', 'true')

  // Removed from the favourites page, it stays until the page is shown again, so it can be put back. (The sidebar
  // brings back the tab shown last: Tracks.)
  await heart(page, 'Be My Lover').click()
  await expect(heart(page, 'Be My Lover')).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => api.favourites.track.length).toBe(0)
  await library(page).getByRole('link', { name: 'Artists' }).click()
  await library(page).getByRole('link', { name: 'Favourites' }).click()
  await expect(page.getByText('No favourite tracks yet')).toBeVisible()
})

test('albums and artists become favourites from their pages', async ({ page, api }) => {
  await openAlbum(page, 'Killer')
  await heart(page, 'Killer').click()
  await page.getByRole('main').getByRole('link', { name: 'Alice Cooper' }).first().click()
  await expect(page.getByRole('heading', { name: 'Alice Cooper' })).toBeVisible()
  await heart(page, 'Alice Cooper').click()
  await expect.poll(() => [api.favourites.album.length, api.favourites.artist.length]).toEqual([1, 1])

  await library(page).getByRole('link', { name: 'Favourites' }).click()
  const tabs = page.getByRole('navigation', { name: 'Favourites' })
  await tabs.getByRole('link', { name: 'Albums' }).click()
  await expect(page).toHaveURL('/favourites/albums')
  await expect(page.getByRole('main').getByRole('link', { name: /Killer/ })).toBeVisible()
  await tabs.getByRole('link', { name: 'Artists' }).click()
  await expect(page).toHaveURL('/favourites/artists')
  await expect(page.getByRole('main').getByRole('link', { name: /Alice Cooper/ })).toBeVisible()
})

test('the heart is the same everywhere: search results and the player', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('reptile')
  await heart(page, 'Love Me Like a Reptile').click()
  await page.getByRole('region', { name: 'Tracks' }).getByRole('button', { name: 'Play Love Me Like a Reptile' }).click()

  await expect(player(page).getByRole('button', { name: 'Favourite Love Me Like a Reptile' })).toHaveAttribute('aria-pressed', 'true')

  // Undone from the player, the search result follows.
  await player(page).getByRole('button', { name: 'Favourite Love Me Like a Reptile' }).click()
  await expect(heart(page, 'Love Me Like a Reptile')).toHaveAttribute('aria-pressed', 'false')
})

test('when the API refuses, the heart goes back and says so', async ({ page, api }) => {
  await openAlbum(page, 'Killer')
  api.failFavourites = 1

  await heart(page, 'Halo of Flies').click()

  await expect(page.getByText("Couldn't add “Halo of Flies” to your favourites.")).toBeVisible()
  await expect(heart(page, 'Halo of Flies')).toHaveAttribute('aria-pressed', 'false')
})

test('Play on the favourites page plays them, newest first', async ({ page }) => {
  await openAlbum(page, 'Killer')
  await heart(page, 'Under My Wheels').click()
  await heart(page, 'Halo of Flies').click()

  await library(page).getByRole('link', { name: 'Favourites' }).click()
  await page.getByRole('navigation', { name: 'Favourites' }).getByRole('link', { name: 'Tracks' }).click()
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()

  await expect(player(page).getByRole('link').first()).toHaveText('Halo of Flies')
  await expect(page.getByRole('main').getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('on a small screen the navigation slides in from the header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await expect(library(page)).toBeHidden()
  const menu = page.getByRole('button', { name: 'Open the navigation' })

  await menu.click()
  const drawer = page.getByRole('dialog', { name: 'Navigation' })
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(menu).toBeFocused()

  await menu.click()
  await drawer.getByRole('link', { name: 'Favourites' }).click()
  await expect(page).toHaveURL('/favourites/artists')
  await expect(drawer).toHaveCount(0)
})

test('an artist becomes a favourite from its card, and its card says so everywhere', async ({ page, api }) => {
  const heartOf = (scope: ReturnType<Page['getByRole']>) => scope.getByRole('button', { name: 'Favourite Accept' })

  await heartOf(page.getByRole('main')).click()
  await expect(heartOf(page.getByRole('main'))).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => api.favourites.artist).toEqual([api.artistNamed('Accept').id])

  await page.getByRole('searchbox', { name: 'Search the library' }).fill('accept')
  await expect(heartOf(page.getByRole('region', { name: 'Artists' }))).toHaveAttribute('aria-pressed', 'true')

  await library(page).getByRole('link', { name: 'Favourites' }).click()
  await page.getByRole('navigation', { name: 'Favourites' }).getByRole('link', { name: 'Artists' }).click()
  await expect(heartOf(page.getByRole('main'))).toHaveAttribute('aria-pressed', 'true')
})

test('Favourites opens on Artists the first time, then on the tab shown last, also after a reload', async ({ page }) => {
  const tabs = page.getByRole('navigation', { name: 'Favourites' })
  await library(page).getByRole('link', { name: 'Favourites' }).click()
  await expect(page).toHaveURL('/favourites/artists')
  await expect(tabs.getByRole('link', { name: 'Artists' })).toHaveAttribute('aria-current', 'page')

  await tabs.getByRole('link', { name: 'Albums' }).click()
  await library(page).getByRole('link', { name: 'Artists' }).click()
  await library(page).getByRole('link', { name: 'Favourites' }).click()
  await expect(page).toHaveURL('/favourites/albums')
  await expect(library(page).getByRole('link', { name: 'Favourites' })).toHaveAttribute('aria-current', 'page')

  await page.goto('/')
  await library(page).getByRole('link', { name: 'Favourites' }).click()
  await expect(page).toHaveURL('/favourites/albums')
})
