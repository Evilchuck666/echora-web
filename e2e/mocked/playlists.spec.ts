import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'

const player = (page: Page) => page.getByRole('region', { name: 'Player' })
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Playlists' })
const dialog = (page: Page) => page.getByRole('dialog')

/** The titles of the playlist page's tracks, in order. */
async function titles(page: Page): Promise<string[]> {
  const buttons = page.getByRole('main').getByRole('list').getByRole('button', { name: /^Move / })
  // ("Remove … from the playlist" doesn't start with "Move".)
  return (await buttons.evaluateAll((all) => all.map((button) => button.getAttribute('aria-label')))).map((label) => label!.slice('Move '.length))
}

async function openAlbum(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill(title)
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

async function addToPlaylist(page: Page, menu: string, playlist: string) {
  await page.getByRole('button', { name: `More options for ${menu}` }).first().click()
  await page.getByRole('menuitem', { name: 'Add to playlist…' }).click()
  await dialog(page).getByRole('button', { name: new RegExp(`^${playlist}`) }).click()
  await expect(dialog(page)).toHaveCount(0)
}

test.beforeEach(async ({ signIn }) => signIn())

test('a new playlist, made from the sidebar, opens empty and is listed', async ({ page }) => {
  await sidebar(page).getByRole('button', { name: 'New playlist' }).click()
  await dialog(page).getByLabel('Name').fill('Road trip')
  await dialog(page).getByRole('button', { name: 'Create' }).click()

  await expect(page).toHaveURL(/\/playlists\//)
  await expect(page.getByRole('heading', { name: 'Road trip' })).toBeVisible()
  await expect(page.getByText('This playlist is empty')).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: 'Road trip' })).toHaveAttribute('aria-current', 'page')
})

test('tracks and whole albums are added from their menu, repeats included, and the playlist plays them', async ({ page, api }) => {
  api.addPlaylist('Mix')
  await openAlbum(page, 'Killer')

  await addToPlaylist(page, 'Be My Lover', 'Mix')
  await expect(page.getByText('“Be My Lover” added to “Mix”')).toBeVisible()
  await addToPlaylist(page, 'Killer', 'Mix')
  await expect(page.getByText('3 tracks added to “Mix”')).toBeVisible()

  await sidebar(page).getByRole('link', { name: 'Mix' }).click()
  await expect(page.getByRole('heading', { name: 'Mix' })).toBeVisible()
  await expect.poll(() => titles(page)).toEqual(['Be My Lover', 'Under My Wheels', 'Be My Lover', 'Halo of Flies'])
  await expect(page.getByRole('main')).toContainText('4 tracks · 0:48')

  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player(page).getByRole('link').first()).toHaveText('Be My Lover')
  await expect(page.getByRole('main').getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('a playlist can be made in the dialog, with what is being added', async ({ page, api }) => {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('reptile')
  await page.getByRole('button', { name: 'More options for Love Me Like a Reptile' }).click()
  await page.getByRole('menuitem', { name: 'Add to playlist…' }).click()

  await dialog(page).getByLabel('Name').fill('Fast')
  await dialog(page).getByRole('button', { name: 'Create and add' }).click()

  await expect(page.getByText('“Love Me Like a Reptile” added to “Fast”')).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: 'Fast' })).toBeVisible()
  expect(api.playlists.map((p) => [p.name, p.items.length])).toEqual([['Fast', 1]])
})

test('tracks move by their handle (here, from the keyboard) and leave one appearance at a time', async ({ page, api }) => {
  const playlist = api.addPlaylist('Order', ['Under My Wheels', 'Be My Lover', 'Halo of Flies', 'Be My Lover'])
  await page.goto(`/playlists/${playlist.id}`)
  await expect.poll(() => titles(page)).toEqual(['Under My Wheels', 'Be My Lover', 'Halo of Flies', 'Be My Lover'])

  await page.getByRole('button', { name: 'Move Halo of Flies', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('Halo of Flies is at position 3 of 4.')).toBeAttached()
  // dnd-kit listens for the arrows from a timeout after the pick-up: let it run.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('Halo of Flies is at position 2 of 4.')).toBeAttached()
  await page.keyboard.press('Space')

  await expect.poll(() => titles(page)).toEqual(['Under My Wheels', 'Halo of Flies', 'Be My Lover', 'Be My Lover'])
  await page.getByRole('button', { name: 'Remove Be My Lover from the playlist' }).first().click()
  await expect.poll(() => titles(page)).toEqual(['Under My Wheels', 'Halo of Flies', 'Be My Lover'])

  // As the API keeps it.
  await page.reload()
  await expect.poll(() => titles(page)).toEqual(['Under My Wheels', 'Halo of Flies', 'Be My Lover'])
  await expect(page.getByRole('main')).toContainText('3 tracks')
})

test('a playlist is renamed, and deleted after a confirmation', async ({ page, api }) => {
  const playlist = api.addPlaylist('Old name', ['Starlight'])
  await page.goto(`/playlists/${playlist.id}`)

  await page.getByRole('button', { name: 'More options for Old name' }).click()
  await page.getByRole('menuitem', { name: 'Rename…' }).click()
  await dialog(page).getByLabel('Name').fill('New name')
  await dialog(page).getByRole('button', { name: 'Rename' }).click()
  await expect(page.getByRole('heading', { name: 'New name' })).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: 'New name' })).toBeVisible()

  await page.getByRole('button', { name: 'More options for New name' }).click()
  await page.getByRole('menuitem', { name: 'Delete…' }).click()
  await expect(dialog(page)).toContainText('its tracks stay in the library')
  await dialog(page).getByRole('button', { name: 'Delete' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByText('“New name” deleted')).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: 'New name' })).toHaveCount(0)
  expect(api.playlists).toEqual([])
})

test("a playlist that doesn't exist (or is someone else's) says so", async ({ page }) => {
  await page.goto('/playlists/00000000-0000-4000-9000-999999999999')

  await expect(page.getByText("This playlist doesn't exist, or isn't yours.")).toBeVisible()
})

test('the playlists are in the order the user gives them, by dragging (or from the keyboard), and a new one comes first', async ({ page, api }) => {
  const names = async () => (await sidebar(page).getByRole('link').allTextContents()).map((name) => name.trim())
  api.addPlaylist('First')
  api.addPlaylist('Second')
  api.addPlaylist('Third')
  await page.reload()
  await expect.poll(names).toEqual(['Third', 'Second', 'First'])

  // From the keyboard: First up two places.
  await sidebar(page).getByRole('button', { name: 'Move First' }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('First is at position 3 of 3.')).toBeAttached()
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('First is at position 2 of 3.')).toBeAttached()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('First is at position 1 of 3.')).toBeAttached()
  await page.keyboard.press('Space')
  await expect.poll(names).toEqual(['First', 'Third', 'Second'])

  // With the mouse: Third to the bottom.
  const handle = (await sidebar(page).getByRole('button', { name: 'Move Third' }).boundingBox())!
  const target = (await sidebar(page).getByRole('button', { name: 'Move Second' }).boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 2, { steps: 12 })
  await page.mouse.up()
  await expect.poll(names).toEqual(['First', 'Second', 'Third'])

  // As the API keeps it, the same on every device.
  await expect.poll(() => api.playlists.map((p) => p.name)).toEqual(['First', 'Second', 'Third'])
  await page.reload()
  await expect.poll(names).toEqual(['First', 'Second', 'Third'])

  await sidebar(page).getByRole('button', { name: 'New playlist' }).click()
  await dialog(page).getByLabel('Name').fill('Newest')
  await dialog(page).getByRole('button', { name: 'Create' }).click()
  await expect.poll(names).toEqual(['Newest', 'First', 'Second', 'Third'])
})
