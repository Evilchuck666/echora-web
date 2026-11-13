import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'
import { TRACK_SECONDS, USERNAME } from '../support/mock-api.ts'

const player = (page: Page) => page.getByRole('region', { name: 'Player' })
const nowPlaying = (page: Page) => player(page).getByRole('link').first()
const library = (page: Page) => page.getByRole('navigation', { name: 'Library' })

async function openAlbum(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill(title)
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

test.beforeEach(async ({ signIn }) => signIn())

test('a track counts once half of it has played, and History lists it', async ({ page, api }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('button', { name: 'Play Halo of Flies' }).click()
  await expect(nowPlaying(page)).toHaveText('Halo of Flies')

  // Half of the track (TRACK_SECONDS) has to play.
  await expect.poll(() => api.plays.length, { timeout: (TRACK_SECONDS / 2 + 5) * 1000 }).toBe(1)
  expect(api.plays[0]).toMatchObject({ userId: api.userNamed(USERNAME).id, trackId: api.tracks.find((t) => t.title === 'Halo of Flies')!.id })
  await player(page).getByRole('button', { name: 'Pause' }).click()

  await library(page).getByRole('link', { name: 'History' }).click()
  await expect(page).toHaveURL('/history/recent')
  const row = page.getByRole('main').getByRole('listitem').filter({ hasText: 'Halo of Flies' })
  await expect(row).toContainText('just now · 1 play')

  // Played again from History, it is reported again (the API keeps one of two plays within 30 seconds: here, one).
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  const reports = () => api.requests.filter((request) => /^POST \/api\/tracks\/[^/]+\/plays$/.test(request)).length
  await expect.poll(reports, { timeout: (TRACK_SECONDS / 2 + 5) * 1000 }).toBe(2)
  expect(api.plays).toHaveLength(1)
})

test('Most played: the most played first, over a period', async ({ page, api }) => {
  const me = api.userNamed(USERNAME).id
  const id = (title: string) => api.tracks.find((t) => t.title === title)!.id
  const daysAgo = (days: number) => Date.now() - days * 86_400_000
  api.plays.push(
    { userId: me, trackId: id('Breaker'), at: daysAgo(40) },
    { userId: me, trackId: id('Breaker'), at: daysAgo(41) },
    { userId: me, trackId: id('Breaker'), at: daysAgo(42) },
    { userId: me, trackId: id('Love Child'), at: daysAgo(1) },
    { userId: me, trackId: id('Love Child'), at: daysAgo(2) },
  )

  await page.goto('/history/top')
  const rows = page.getByRole('main').getByRole('listitem')
  await expect(rows.first()).toContainText('Breaker')
  await expect(rows.first()).toContainText('3 plays')
  await expect(rows.nth(1)).toContainText('Love Child')

  await page.getByRole('radiogroup', { name: 'Period' }).getByRole('radio', { name: 'This month' }).click()
  await expect(page).toHaveURL('/history/top?period=month')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Love Child')
  await expect(rows.first()).toContainText('2 plays')

  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(nowPlaying(page)).toHaveText('Love Child')
})

test('the history is cleared from the profile', async ({ page, api }) => {
  const me = api.userNamed(USERNAME).id
  api.plays.push({ userId: me, trackId: api.tracks[0].id, at: Date.now() })
  await page.goto('/history/recent')
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1)

  await page.goto('/profile')
  await page.getByRole('button', { name: 'Clear listening history' }).click()
  await page.getByRole('dialog', { name: 'Clear your listening history?' }).getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByText('Listening history cleared')).toBeVisible()
  expect(api.plays).toEqual([])

  await library(page).getByRole('link', { name: 'History' }).click()
  await expect(page.getByText('Nothing yet: the tracks you listen to show up here.')).toBeVisible()
})
