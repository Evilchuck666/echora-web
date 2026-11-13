import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'

const player = (page: Page) => page.getByRole('region', { name: 'Player' })
const nowPlaying = (page: Page) => player(page).getByRole('link').first()

async function openAlbum(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill(title)
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

test.beforeEach(async ({ signIn }) => signIn())

test("a track's lyrics are read from the album page without playing it", async ({ page }) => {
  await openAlbum(page, 'Killer')

  await page.getByRole('button', { name: 'Show the lyrics of Halo of Flies' }).click()

  const dialog = page.getByRole('dialog', { name: 'Lyrics of “Halo of Flies”' })
  await expect(dialog).toContainText('Halo of Flies, the first line')
  await expect(dialog).toContainText('Alice Cooper')
  // A double click in the lyrics (selecting a word) doesn't reach the track's row, which would play it.
  await dialog.getByText('The chorus').dblclick()
  await expect(player(page)).toContainText('Nothing playing')

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show the lyrics of Halo of Flies' })).toBeFocused()
  // Tracks without lyrics have no badge.
  await expect(page.getByRole('button', { name: 'Show the lyrics of Be My Lover' })).toHaveCount(0)
})

test('"Show lyrics" in the menu of a track with lyrics, and the music plays on', async ({ page }) => {
  await openAlbum(page, 'Balls to the Wall')
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(nowPlaying(page)).toHaveText('Balls to the Wall')

  await page.getByRole('searchbox', { name: 'Search the library' }).fill('wheels')
  const tracks = page.getByRole('region', { name: 'Tracks' })
  await tracks.getByRole('button', { name: 'More options for Under My Wheels' }).click()
  await page.getByRole('menuitem', { name: 'Show lyrics' }).click()

  const dialog = page.getByRole('dialog', { name: 'Lyrics of “Under My Wheels”' })
  await expect(dialog).toContainText('Under My Wheels, the first line')
  await expect(nowPlaying(page)).toHaveText('Balls to the Wall')
  await expect(player(page).getByRole('button', { name: 'Pause' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()

  // A track without lyrics doesn't offer them.
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('lover')
  await tracks.getByRole('button', { name: 'More options for Be My Lover' }).click()
  await expect(page.getByRole('menuitem', { name: 'Add to queue' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Show lyrics' })).toHaveCount(0)
})
