import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'
import { TRACK_SECONDS } from '../support/mock-api.ts'

const player = (page: Page) => page.getByRole('region', { name: 'Player' })
const position = (page: Page) => player(page).getByRole('slider', { name: 'Position in the track' })

async function expectPlaying(page: Page) {
  const start = Number(await position(page).inputValue())
  await expect(async () => expect(Number(await position(page).inputValue())).toBeGreaterThan(start + 0.5)).toPass({ timeout: 10_000 })
}

async function openAlbum(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill(title)
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

test.beforeEach(async ({ signIn }) => signIn())

test('playing an album: the player, the marked track, the system controls', async ({ page }) => {
  await expect(player(page)).toHaveCount(0)
  await openAlbum(page, 'Balls to the Wall')

  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()

  await expect(player(page).getByRole('link').first()).toHaveText('Balls to the Wall')
  await expectPlaying(page)
  await expect(page.getByRole('main').getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause Balls to the Wall' })).toBeAttached()
  expect(await page.evaluate(() => [navigator.mediaSession.metadata?.title, navigator.mediaSession.metadata?.artist])).toEqual([
    'Balls to the Wall',
    'Accept',
  ])
})

test('the music goes on while browsing', async ({ page }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('button', { name: 'Play Be My Lover' }).click()
  await expectPlaying(page)

  await page.getByRole('link', { name: 'Echora' }).click()
  await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible()

  await expect(player(page).getByRole('link').first()).toHaveText('Be My Lover')
  await expectPlaying(page)
})

test('space pauses and resumes, arrows move in the track', async ({ page }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expectPlaying(page)
  await page.getByRole('heading', { name: 'Killer' }).click()

  await page.keyboard.press(' ')
  await expect(player(page).getByRole('button', { name: 'Play' })).toBeVisible()
  const paused = await position(page).inputValue()
  await page.waitForTimeout(700)
  expect(await position(page).inputValue()).toBe(paused)

  await page.keyboard.press(' ')
  await expectPlaying(page)

  const before = Number(await position(page).inputValue())
  await page.keyboard.press('ArrowRight')
  await expect(async () => expect(Number(await position(page).inputValue())).toBeGreaterThanOrEqual(Math.min(before + 4.5, TRACK_SECONDS - 1))).toPass()
})

test('next, previous, and on to the next track at the end of one', async ({ page }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  const title = player(page).getByRole('link').first()
  await expect(title).toHaveText('Under My Wheels')

  await player(page).getByRole('button', { name: 'Next' }).click()
  await expect(title).toHaveText('Be My Lover')

  // At the start of a track, Previous goes to the one before; later, back to the start of the track.
  await player(page).getByRole('button', { name: 'Previous' }).click()
  await expect(title).toHaveText('Under My Wheels')
  await expect(async () => expect(Number(await position(page).inputValue())).toBeGreaterThan(3.5)).toPass({ timeout: 10_000 })
  await player(page).getByRole('button', { name: 'Previous' }).click()
  await expect(title).toHaveText('Under My Wheels')
  expect(Number(await position(page).inputValue())).toBeLessThan(2)

  await position(page).focus()
  await page.keyboard.press('End')
  await expect(title).toHaveText('Be My Lover')
  await expectPlaying(page)

  // The last track can't skip further.
  await player(page).getByRole('button', { name: 'Next' }).click()
  await expect(title).toHaveText('Halo of Flies')
  await expect(player(page).getByRole('button', { name: 'Next' })).toBeDisabled()
})

test('mute is remembered, the queue is not', async ({ page }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await player(page).getByRole('button', { name: 'Mute' }).click()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Killer' })).toBeVisible()
  await expect(player(page)).toHaveCount(0)

  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player(page).getByRole('button', { name: 'Unmute' })).toBeVisible()
})

test('a search result plays on its own', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('reptile')
  await page.getByRole('region', { name: 'Tracks' }).getByRole('button', { name: 'Play Love Me Like a Reptile' }).click()

  await expect(player(page).getByRole('link').first()).toHaveText('Love Me Like a Reptile')
  await expectPlaying(page)
  await expect(player(page).getByRole('button', { name: 'Next' })).toBeDisabled()
})

test('the lyrics panel follows the track that is playing', async ({ page, api }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  const lyricsButton = player(page).getByRole('button', { name: 'Lyrics' })
  const panel = page.getByRole('complementary', { name: 'Lyrics' })

  await lyricsButton.click()
  await expect(lyricsButton).toHaveAttribute('aria-expanded', 'true')
  await expect(panel.getByRole('heading', { name: 'Under My Wheels' })).toBeVisible()
  await expect(panel).toContainText('Under My Wheels, the first line')
  await expect(panel).toContainText('The chorus')

  // The next track has no lyrics: the panel says so, without asking the API.
  const trackRequests = () => api.requests.filter((r) => /^GET \/api\/tracks\/[^/?]+$/.test(r)).length
  const before = trackRequests()
  await player(page).getByRole('button', { name: 'Next' }).click()
  await expect(panel.getByRole('heading', { name: 'Be My Lover' })).toBeVisible()
  await expect(panel).toContainText('This track has no lyrics.')
  expect(trackRequests()).toBe(before)

  await player(page).getByRole('button', { name: 'Next' }).click()
  await expect(panel).toContainText('Halo of Flies, the first line')

  await lyricsButton.click()
  await expect(panel).toHaveCount(0)
  await expect(lyricsButton).toHaveAttribute('aria-expanded', 'false')
  await expectPlaying(page)
})

test('a track without lyrics can not open the panel', async ({ page }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('button', { name: 'Play Be My Lover' }).click()
  await expect(player(page).getByRole('link').first()).toHaveText('Be My Lover')

  await expect(player(page).getByRole('button', { name: 'Lyrics' })).toBeDisabled()

  await player(page).getByRole('button', { name: 'Next' }).click()
  await player(page).getByRole('button', { name: 'Lyrics' }).click()
  const panel = page.getByRole('complementary', { name: 'Lyrics' })
  await expect(panel).toContainText('Halo of Flies, the first line')
  await panel.getByRole('button', { name: 'Close the lyrics' }).click()
  await expect(panel).toHaveCount(0)
})

test('below large screens the panels float: side by side when there is room, one at a time otherwise', async ({ page }) => {
  // Too narrow for the column (see the next test), wide enough for two floating panels.
  await page.setViewportSize({ width: 1100, height: 720 })
  await openAlbum(page, 'Killer')
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  const lyrics = page.getByRole('complementary', { name: 'Lyrics' })
  const queue = page.getByRole('complementary', { name: 'Queue' })

  await player(page).getByRole('button', { name: 'Lyrics' }).click()
  await player(page).getByRole('button', { name: 'Queue' }).click()

  await expect(lyrics).toContainText('Under My Wheels, the first line')
  await expect(queue).toContainText('Be My Lover')
  const [left, right] = [await lyrics.boundingBox(), await queue.boundingBox()]
  expect(left!.x + left!.width).toBeLessThan(right!.x)

  // Escape closes the last one opened.
  await page.keyboard.press('Escape')
  await expect(queue).toHaveCount(0)
  await expect(lyrics).toBeVisible()
  await player(page).getByRole('button', { name: 'Queue' }).click()
  await expect(queue).toBeVisible()

  // No room for two: the last one opened stays, and opening the other replaces it.
  await page.setViewportSize({ width: 390, height: 780 })
  await expect(lyrics).toHaveCount(0)
  await expect(queue).toBeVisible()
  await expect(player(page).getByRole('button', { name: 'Lyrics' })).toHaveAttribute('aria-expanded', 'false')
  await player(page).getByRole('button', { name: 'Lyrics' }).click()
  await expect(lyrics).toBeVisible()
  await expect(queue).toHaveCount(0)
})

test('on large screens a column holds the panels, the queue from the start, next to the page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const lyrics = page.getByRole('complementary', { name: 'Lyrics' })
  const queue = page.getByRole('complementary', { name: 'Queue' })
  await expect(queue).toHaveCount(0)

  await openAlbum(page, 'Killer')
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()

  // The queue shows without asking, and the page makes room for it instead of being covered.
  await expect(queue).toContainText('Be My Lover')
  await expect(player(page).getByRole('button', { name: 'Queue' })).toHaveAttribute('aria-expanded', 'true')
  const content = await page.getByRole('main').boundingBox()
  const column = await queue.boundingBox()
  expect(content!.x + content!.width).toBeLessThanOrEqual(column!.x)

  // The lyrics go below the queue, which stays where it was; Escape leaves the column alone.
  const queueTop = (await queue.boundingBox())!.y
  await player(page).getByRole('button', { name: 'Lyrics' }).click()
  await expect(lyrics).toContainText('Under My Wheels, the first line')
  expect((await queue.boundingBox())!.y).toBe(queueTop)
  expect((await lyrics.boundingBox())!.y).toBeGreaterThan(queueTop)
  await page.keyboard.press('Escape')
  await expect(queue).toBeVisible()
  await expect(lyrics).toBeVisible()

  // What is open is remembered.
  await queue.getByRole('button', { name: 'Close the queue' }).click()
  await player(page).getByRole('button', { name: 'Lyrics' }).click()
  await expect(lyrics).toHaveCount(0)
  await expect(queue).toHaveCount(0)
  // The page takes the room back.
  const wider = (await page.getByRole('main').boundingBox())!
  expect(wider.x + wider.width).toBeGreaterThan(column!.x)
  await page.reload()
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player(page).getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(queue).toHaveCount(0)
  await player(page).getByRole('button', { name: 'Queue' }).click()
  await expect(queue).toBeVisible()
})

test('an expired stream URL is renewed and the track plays', async ({ page, api }) => {
  await openAlbum(page, 'Killer')
  api.expiredStreams = 1

  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()

  await expectPlaying(page)
  expect(api.requests.filter((r) => /^GET \/api\/tracks\/[^/?]+$/.test(r))).toHaveLength(1)
})

test('signing out stops the music', async ({ page }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expectPlaying(page)

  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL('/login')
  await expect(player(page)).toHaveCount(0)
  expect(await page.evaluate(() => navigator.mediaSession.metadata)).toBeNull()
})
