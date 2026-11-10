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
