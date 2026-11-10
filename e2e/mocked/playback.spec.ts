import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'

const player = (page: Page) => page.getByRole('region', { name: 'Player' })
const nowPlaying = (page: Page) => player(page).getByRole('link').first()
const position = (page: Page) => player(page).getByRole('slider', { name: 'Position in the track' })

async function expectPlaying(page: Page) {
  const start = Number(await position(page).inputValue())
  await expect(async () => expect(Number(await position(page).inputValue())).toBeGreaterThan(start + 0.5)).toPass({ timeout: 10_000 })
}

async function playAlbum(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill(title)
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(nowPlaying(page)).toBeVisible()
}

test.beforeEach(async ({ page, signIn }) => {
  // The engine's audio elements aren't in the page: keep a hand on them.
  await page.addInitScript(() => {
    const elements: HTMLAudioElement[] = []
    Object.assign(window, { audioElements: elements })
    const Original = window.Audio
    window.Audio = class extends Original {
      constructor(src?: string) {
        super(src)
        elements.push(this)
      }
    } as typeof Audio
  })
  await signIn()
})

test('the next track loads while the current one plays, and is ready when it ends', async ({ page, api }) => {
  const [, next] = api.tracks.filter((track) => track.albumId === api.albumTitled('Killer').id)
  await playAlbum(page, 'Killer')
  await expectPlaying(page)

  // The mock's tracks are shorter than the preload window: the next one loads at once.
  await expect.poll(() => api.requests.some((request) => request.startsWith(`GET /api/tracks/${next.id}/stream`))).toBe(true)
  await expect(nowPlaying(page)).toHaveText('Under My Wheels')

  // When the track ends, the other element already has the next one's audio (HAVE_ENOUGH_DATA).
  const readyStateAtTheEnd = page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const elements = (window as unknown as { audioElements: HTMLAudioElement[] }).audioElements
        const playing = elements.find((element) => !element.paused)!
        playing.addEventListener('ended', () => resolve(elements.find((element) => element !== playing)!.readyState), { once: true })
      }),
  )
  await position(page).focus()
  await page.keyboard.press('End')
  expect(await readyStateAtTheEnd).toBe(4)

  await expect(nowPlaying(page)).toHaveText('Be My Lover')
  await expectPlaying(page)
})

test('only one tab plays at a time', async ({ page, context }) => {
  await playAlbum(page, 'Killer')
  await expectPlaying(page)

  // The session is shared: the second tab is signed in already.
  const other = await context.newPage()
  await other.goto('/')
  await playAlbum(other, 'Breaker')
  await expectPlaying(other)

  await expect(player(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(nowPlaying(page)).toHaveText('Under My Wheels')

  // Resuming the first tab pauses the second one in turn.
  await player(page).getByRole('button', { name: 'Play', exact: true }).click()
  await expectPlaying(page)
  await expect(player(other).getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('the data saver plays FLAC tracks as Opus, MP3 tracks as they are, and is remembered', async ({ page, api }) => {
  const quality = (label: string) => player(page).getByRole('button', { name: `Audio quality: ${label}` })
  const streams = (album: string, opus: boolean) =>
    api.tracks
      .filter((track) => track.albumId === api.albumTitled(album).id)
      .some((track) => api.requests.some((request) => request.startsWith(`GET /api/tracks/${track.id}/stream${opus ? '/opus' : '?'}`)))

  await quality('Original').click()
  await expect(page.getByRole('menuitemradio', { name: /Original/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: /Data saver/ }).click()
  await expect(quality('Data saver')).toBeVisible()

  await playAlbum(page, 'Killer')
  await expectPlaying(page)
  expect(streams('Killer', true)).toBe(true)
  expect(streams('Killer', false)).toBe(false)

  await page.getByRole('searchbox', { name: 'Search the library' }).fill('reptile')
  await page.getByRole('region', { name: 'Tracks' }).getByRole('button', { name: 'Play Love Me Like a Reptile' }).click()
  await expect(nowPlaying(page)).toHaveText('Love Me Like a Reptile')
  await expectPlaying(page)
  expect(streams('Ace of Spades', false)).toBe(true)
  expect(streams('Ace of Spades', true)).toBe(false)

  await page.reload()
  await expect(quality('Data saver')).toBeVisible()
})

test('switching the quality keeps playing where the track was', async ({ page, api }) => {
  const [first] = api.tracks.filter((track) => track.albumId === api.albumTitled('Killer').id)
  await playAlbum(page, 'Killer')
  await expect(async () => expect(Number(await position(page).inputValue())).toBeGreaterThan(3)).toPass({ timeout: 10_000 })

  await player(page).getByRole('button', { name: 'Audio quality: Original' }).click()
  await page.getByRole('menuitemradio', { name: /Data saver/ }).click()

  await expect.poll(() => api.requests.some((request) => request.startsWith(`GET /api/tracks/${first.id}/stream/opus`))).toBe(true)
  await expect(nowPlaying(page)).toHaveText('Under My Wheels')
  expect(Number(await position(page).inputValue())).toBeGreaterThan(2.5)
  await expectPlaying(page)
})
