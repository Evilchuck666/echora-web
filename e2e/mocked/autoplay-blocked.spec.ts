import { expect, test } from '../support/fixtures.ts'

// Firefox set to block audio and video, where every play() needs a click of its own (media.autoplay.default 5,
// blocking_policy 2): what hardened setups such as LibreWolf or arkenfox use. The next track can't start by itself
// there; the player has to say so rather than stop silently.
test.use({ launchOptions: { firefoxUserPrefs: { 'media.autoplay.default': 5, 'media.autoplay.blocking_policy': 2 } } })

test.beforeEach(async ({ signIn, browserName }) => {
  test.skip(browserName !== 'firefox', 'Firefox preferences')
  await signIn()
})

test('when the browser blocks autoplay, the player says so and Play goes on', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('Killer')
  await page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: /Killer/ }).click()
  await page.getByRole('main').getByRole('button', { name: 'Play', exact: true }).click()
  const player = page.getByRole('region', { name: 'Player' })
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()

  // The first track ends by itself (the mock's tracks last 12 s): the next one is blocked.
  await expect(player.getByRole('link').first()).toHaveText('Be My Lover', { timeout: 20_000 })
  await expect(player.getByRole('alert')).toContainText('Autoplay blocked: press Play')

  await player.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(player.getByRole('alert')).toHaveCount(0)
})
