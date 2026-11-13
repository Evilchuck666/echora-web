import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'

const player = (page: Page) => page.getByRole('region', { name: 'Player' })
const opener = (page: Page) => player(page).getByRole('button', { name: 'Now playing' })
const view = (page: Page) => page.getByRole('region', { name: /^Now playing:/ })

async function playAlbum(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill(title)
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player(page).getByRole('link').first()).toHaveText('Under My Wheels')
}

test.beforeEach(async ({ signIn }) => signIn())

test("the cover in the bar opens the track in large, and the view follows the player", async ({ page }) => {
  await expect(opener(page)).toBeDisabled()
  await playAlbum(page, 'Killer')

  await opener(page).click()
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(view(page)).toHaveAccessibleName('Now playing: Under My Wheels')
  await expect(view(page).getByRole('heading', { name: 'Under My Wheels' })).toBeVisible()
  await expect(view(page).getByRole('img', { name: 'Cover of Killer' })).toBeVisible()
  await expect(view(page)).toContainText('Next Be My Lover')
  await expect(view(page).getByRole('button', { name: 'Close Now playing' })).toBeFocused()

  await player(page).getByRole('button', { name: 'Next' }).click()
  await expect(view(page).getByRole('heading', { name: 'Be My Lover' })).toBeVisible()

  // Escape closes it, and the focus goes back to the cover in the bar.
  await page.keyboard.press('Escape')
  await expect(view(page)).toHaveCount(0)
  await expect(opener(page)).toBeFocused()
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'false')
})

test('its links go to the artist or the album, closing it; × closes it too', async ({ page }) => {
  await playAlbum(page, 'Killer')
  await page.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: 'Tracks' }).click()

  await opener(page).click()
  await view(page).getByRole('link', { name: 'Alice Cooper' }).click()
  await expect(view(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Alice Cooper' })).toBeVisible()

  await opener(page).click()
  await view(page).getByRole('button', { name: 'Close Now playing' }).click()
  await expect(view(page)).toHaveCount(0)
})

test('on a phone it has the controls the bar has no room for', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await playAlbum(page, 'Killer')
  await expect(player(page).getByRole('button', { name: 'Previous' })).toBeHidden()

  await opener(page).click()
  await expect(view(page).getByRole('slider', { name: 'Position in the track' })).toBeVisible()
  await view(page).getByRole('button', { name: 'Shuffle' }).click()
  await expect(view(page).getByRole('button', { name: 'Shuffle' })).toHaveAttribute('aria-pressed', 'true')
  await view(page).getByRole('button', { name: 'Pause' }).click()
  await expect(player(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('Escape closes a panel floating over it first, then the view', async ({ page }) => {
  // Below the width of the docked column: the panels float over the page.
  await page.setViewportSize({ width: 1024, height: 800 })
  await playAlbum(page, 'Killer')
  await opener(page).click()
  await player(page).getByRole('button', { name: 'Lyrics' }).click()
  const lyrics = page.getByRole('complementary', { name: 'Lyrics' })
  await expect(lyrics).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(lyrics).toHaveCount(0)
  await expect(view(page)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(view(page)).toHaveCount(0)
})
