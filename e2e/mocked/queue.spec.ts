import type { Page } from '@playwright/test'
import { expect, test } from '../support/fixtures.ts'

const player = (page: Page) => page.getByRole('region', { name: 'Player' })
const nowPlaying = (page: Page) => player(page).getByRole('link').first()
const queuePanel = (page: Page) => page.getByRole('complementary', { name: 'Queue' })

/** The titles listed under "Next up", in order. */
async function upNext(page: Page): Promise<string[]> {
  const rows = queuePanel(page).getByRole('region', { name: 'Next up' }).getByRole('button', { name: /^Play / })
  return (await rows.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))).map((label) => label!.slice('Play '.length))
}

async function openAlbum(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill(title)
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

async function playAlbum(page: Page, title: string) {
  await openAlbum(page, title)
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(nowPlaying(page)).toBeVisible()
}

async function choose(page: Page, menu: string, action: 'Play next' | 'Add to queue') {
  await page.getByRole('button', { name: `More options for ${menu}` }).first().click()
  await page.getByRole('menu', { name: `More options for ${menu}` }).getByRole('menuitem', { name: action }).click()
}

test.beforeEach(async ({ signIn }) => signIn())

test('the queue panel shows what plays and what comes next; a track plays when clicked, and can be removed', async ({ page }) => {
  await playAlbum(page, 'Balls to the Wall')

  await player(page).getByRole('button', { name: 'Queue' }).click()

  await expect(queuePanel(page).getByRole('region', { name: 'Now playing' })).toContainText('Balls to the Wall')
  expect(await upNext(page)).toEqual(['London Leatherboys', 'Fight It Back', 'Head Over Heels', 'Losing More Than You\'ve Ever Had', 'Love Child'])
  await expect(queuePanel(page)).toContainText('5 tracks to come')

  await queuePanel(page).getByRole('button', { name: 'Play Head Over Heels' }).click()
  await expect(nowPlaying(page)).toHaveText('Head Over Heels')
  await expect.poll(() => upNext(page)).toEqual(['Losing More Than You\'ve Ever Had', 'Love Child'])

  await queuePanel(page).getByRole('button', { name: 'Remove Love Child from the queue' }).click()
  await expect.poll(() => upNext(page)).toEqual(['Losing More Than You\'ve Ever Had'])

  // The tracks played stay in the queue: Previous goes back to them.
  await player(page).getByRole('button', { name: 'Previous' }).click()
  await expect(nowPlaying(page)).toHaveText('Fight It Back')

  await page.keyboard.press('Escape')
  await expect(queuePanel(page)).toHaveCount(0)
})

test('tracks move by dragging their handle, or from the keyboard', async ({ page }) => {
  await playAlbum(page, 'Balls to the Wall')
  await player(page).getByRole('button', { name: 'Queue' }).click()

  const handle = await queuePanel(page).getByRole('button', { name: 'Move Love Child', exact: true }).boundingBox()
  const target = await queuePanel(page).getByRole('button', { name: 'Move London Leatherboys', exact: true }).boundingBox()
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
  await page.mouse.down()
  await page.mouse.move(target!.x + target!.width / 2, target!.y + 4, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => upNext(page)).toEqual(['Love Child', 'London Leatherboys', 'Fight It Back', 'Head Over Heels', 'Losing More Than You\'ve Ever Had'])

  await queuePanel(page).getByRole('button', { name: 'Move Head Over Heels', exact: true }).focus()
  // Each step waits for what a screen reader hears (the live region keeps the latest message only).
  await page.keyboard.press('Space')
  await expect(page.getByText('Head Over Heels is at position 4 of 5.')).toBeAttached()
  // dnd-kit listens for the arrows from a timeout after the pick-up: let it run (faster than any person types).
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('Head Over Heels is at position 3 of 5.')).toBeAttached()
  await page.keyboard.press('Space')
  await expect(page.getByText('Head Over Heels dropped at position 3 of 5.')).toBeAttached()
  await expect.poll(() => upNext(page)).toEqual(['Love Child', 'London Leatherboys', 'Head Over Heels', 'Fight It Back', 'Losing More Than You\'ve Ever Had'])

  // The music follows the new order.
  await player(page).getByRole('button', { name: 'Next' }).click()
  await expect(nowPlaying(page)).toHaveText('Love Child')
})

test('play next and add to queue, from tracks, albums and search results', async ({ page }) => {
  await playAlbum(page, 'Killer')

  await openAlbum(page, 'Balls to the Wall')
  await choose(page, 'Love Child', 'Play next')
  await expect(page.getByText('“Love Child” will play next')).toBeVisible()
  await choose(page, 'Balls to the Wall', 'Add to queue')
  await expect(page.getByText('“Balls to the Wall” added to the queue')).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search the library' }).fill('reptile')
  await choose(page, 'Love Me Like a Reptile', 'Add to queue')

  // An album card queues the whole album.
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('breaker')
  await choose(page, 'Breaker', 'Play next')

  await player(page).getByRole('button', { name: 'Queue' }).click()
  await expect(nowPlaying(page)).toHaveText('Under My Wheels')
  expect(await upNext(page)).toEqual([
    'Starlight', 'Breaker', 'Run If You Can',
    'Love Child',
    'Be My Lover', 'Halo of Flies',
    'Balls to the Wall', 'London Leatherboys', 'Fight It Back', 'Head Over Heels', 'Losing More Than You\'ve Ever Had', 'Love Child',
    'Love Me Like a Reptile',
  ])
})

test('adding to an empty queue loads the tracks without playing them', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('reptile')
  await choose(page, 'Love Me Like a Reptile', 'Add to queue')

  await expect(nowPlaying(page)).toHaveText('Love Me Like a Reptile')
  await expect(player(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('shuffle and repeat are remembered', async ({ page }) => {
  await playAlbum(page, 'Killer')
  const shuffle = player(page).getByRole('button', { name: 'Shuffle' })

  await shuffle.click()
  await expect(shuffle).toHaveAttribute('aria-pressed', 'true')
  await player(page).getByRole('button', { name: 'Repeat: off' }).click()
  await player(page).getByRole('button', { name: 'Repeat: the whole queue' }).click()
  await expect(player(page).getByRole('button', { name: 'Repeat: this track' })).toBeVisible()

  await page.reload()
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player(page).getByRole('button', { name: 'Shuffle' })).toHaveAttribute('aria-pressed', 'true')
  await expect(player(page).getByRole('button', { name: 'Repeat: this track' })).toBeVisible()
})

test('repeating the whole queue starts it again; repeating a track plays it again', async ({ page }) => {
  await openAlbum(page, 'Killer')
  await page.getByRole('button', { name: 'Play Halo of Flies' }).click()
  await expect(nowPlaying(page)).toHaveText('Halo of Flies')
  const position = player(page).getByRole('slider', { name: 'Position in the track' })

  await player(page).getByRole('button', { name: 'Repeat: off' }).click()
  await position.focus()
  await page.keyboard.press('End')
  await expect(nowPlaying(page)).toHaveText('Under My Wheels')

  await player(page).getByRole('button', { name: 'Repeat: the whole queue' }).click()
  await position.focus()
  await page.keyboard.press('End')
  await expect(nowPlaying(page)).toHaveText('Under My Wheels')
  await expect(async () => expect(Number(await position.inputValue())).toBeGreaterThan(0.5)).toPass({ timeout: 10_000 })
  await expect(player(page).getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('play all plays every album of the artist, in order', async ({ page }) => {
  await page.getByRole('link', { name: 'Accept' }).click()
  const playAll = page.getByRole('main').getByRole('button', { name: 'Play all' })

  await playAll.click()

  await expect(nowPlaying(page)).toHaveText('Starlight')
  await expect(page.getByRole('main').getByRole('button', { name: 'Pause' })).toBeVisible()
  await player(page).getByRole('button', { name: 'Queue' }).click()
  expect(await upNext(page)).toEqual([
    'Breaker', 'Run If You Can',
    'Balls to the Wall', 'London Leatherboys', 'Fight It Back', 'Head Over Heels', 'Losing More Than You\'ve Ever Had', 'Love Child',
  ])
})
