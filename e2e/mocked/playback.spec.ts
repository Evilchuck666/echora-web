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
    // When each element starts playing a track and when it plays one to its end, by the element's index.
    const events: { element: number; type: string; src: string; at: number }[] = []
    Object.assign(window, { audioElements: elements, audioEvents: events })
    const Original = window.Audio
    window.Audio = class extends Original {
      constructor(src?: string) {
        super(src)
        elements.push(this)
        for (const type of ['playing', 'ended']) {
          this.addEventListener(type, () => events.push({ element: elements.indexOf(this), type, src: this.src, at: performance.now() }))
        }
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

test('with the data saver on, the API is asked to convert the next FLAC tracks ahead of time', async ({ page, api }) => {
  const killer = api.tracks.filter((track) => track.albumId === api.albumTitled('Killer').id).map((track) => track.id)
  await playAlbum(page, 'Killer')
  await expectPlaying(page)
  // Not with the original files.
  expect(api.transcodes).toEqual([])

  await player(page).getByRole('button', { name: 'Audio quality: Original' }).click()
  await page.getByRole('menuitemradio', { name: /Data saver/ }).click()

  await expect.poll(() => api.transcodes.at(-1)?.tracks).toEqual(killer.slice(1))
  const device = api.transcodes[0].device
  expect(device).toMatch(/^[0-9a-f-]{36}$/)

  await player(page).getByRole('button', { name: 'Next' }).click()
  await expect.poll(() => api.transcodes.at(-1)?.tracks).toEqual(killer.slice(2))
  expect(api.transcodes.at(-1)?.device).toBe(device)

  // Back to the original files: the list is cancelled, once.
  await player(page).getByRole('button', { name: 'Audio quality: Data saver' }).click()
  await page.getByRole('menuitemradio', { name: /Original/ }).click()
  await expect.poll(() => api.transcodes.at(-1)?.tracks).toEqual([])
  const count = api.transcodes.length
  await page.waitForTimeout(1000)
  expect(api.transcodes).toHaveLength(count)
})

test('volume leveling lowers each track by its ReplayGain: the album gain for a whole album, else the track gain', async ({ page }) => {
  const volume = () => page.evaluate(() => (window as unknown as { audioElements: HTMLAudioElement[] }).audioElements.find((element) => element.dataset.player === 'current')!.volume)
  const db = (gain: number) => 10 ** (gain / 20)
  // Killer's files have ReplayGain tags: an album gain of -4 dB, and -7, -8, -9 dB track by track (the mock API).
  await playAlbum(page, 'Killer')
  await expect.poll(volume).toBeCloseTo(db(-4))

  const menu = player(page).getByRole('button', { name: /^Audio quality:/ })
  await expect(menu).toHaveAccessibleName('Audio quality: Original. Volume leveling: Auto')
  await menu.click()
  await expect(page.getByRole('group', { name: 'Volume leveling' }).getByRole('menuitemradio', { name: /^Auto/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: /^Track/ }).click()
  await expect.poll(volume).toBeCloseTo(db(-7))

  await menu.click()
  await page.getByRole('menuitemradio', { name: /^Off/ }).click()
  await expect.poll(volume).toBe(1)

  // Remembered, and a track without tags plays as it is.
  await page.reload()
  await expect(player(page).getByRole('button', { name: /^Audio quality:/ })).toHaveAccessibleName('Audio quality: Original. Volume leveling: Off')
})

/** When the second track of a queue started, and when the first one ended, from the audio elements' own events. */
async function transition(page: Page, first: string, second: string) {
  const events = await page.evaluate(() => (window as unknown as { audioEvents: { type: string; src: string; at: number }[] }).audioEvents)
  const started = events.find((event) => event.type === 'playing' && event.src.includes(second))!.at
  const ended = events.find((event) => event.type === 'ended' && event.src.includes(first))!.at
  return { started, ended }
}

test('a whole album plays without gaps: the next track starts before the current one has ended', async ({ page, api }) => {
  const [first, second] = api.tracks.filter((track) => track.albumId === api.albumTitled('Killer').id)
  await playAlbum(page, 'Killer')

  await expect(nowPlaying(page)).toHaveText('Be My Lover', { timeout: 20_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioEvents: { type: string }[] }).audioEvents.some((event) => event.type === 'ended'))).toBe(true)

  const { started, ended } = await transition(page, first.id, second.id)
  expect(started).toBeLessThan(ended)
})

test('other queues move on when a track ends, as before', async ({ page, api }) => {
  const [first, second] = api.tracks.filter((track) => track.albumId === api.albumTitled('Killer').id)
  await page.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: 'Tracks' }).click()
  await page.getByRole('main').getByRole('button', { name: 'Play Under My Wheels' }).click()

  await expect(nowPlaying(page)).toHaveText('Be My Lover', { timeout: 20_000 })
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { audioEvents: { type: string }[] }).audioEvents)).filter((event) => event.type === 'playing').length).toBeGreaterThanOrEqual(2)

  const { started, ended } = await transition(page, first.id, second.id)
  expect(started).toBeGreaterThanOrEqual(ended)
})
