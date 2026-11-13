import { accountButton, expect, fillSignIn, test } from '../support/fixtures.ts'
import { OTHER } from '../support/mock-api.ts'

// The mock API moves a scan on each time the page reads it (every 2 seconds): queued, its four phases, finished.
const SCAN_TIMEOUT = 20_000

test('an administrator scans the library, follows it, reads the report, and the new music shows up', async ({ page, signIn, api }) => {
  await signIn()
  await accountButton(page).click()
  await page.getByRole('menuitem', { name: 'Library' }).click()
  await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
  await expect(page.getByText('The library has never been scanned.')).toBeVisible()

  await page.getByRole('button', { name: 'Scan now' }).click()
  const latest = page.getByRole('region', { name: 'Latest scan' })
  await expect(page.getByRole('button', { name: 'Scan now' })).toBeDisabled()
  await expect(latest.getByRole('progressbar', { name: 'Reading the files (step 2 of 4)' })).toBeVisible({ timeout: SCAN_TIMEOUT })
  await expect(latest).toContainText('2 of 5 files')

  await expect(latest.getByRole('heading', { name: 'Scan finished' })).toBeVisible({ timeout: SCAN_TIMEOUT })
  await expect(latest.getByText('Added', { exact: true }).locator('..')).toContainText('1')
  await expect(latest).toContainText('Saxon/Broken/01 Noise.flac')
  await expect(page.getByRole('button', { name: 'Scan now' })).toBeEnabled()
  await expect(page.getByRole('region', { name: 'Scans' })).toContainText('From the app')
  await expect(page.getByRole('region', { name: 'Scans' })).toContainText('1 added · 1 unreadable')
  expect(api.scans.map((scan) => [scan.full, scan.trigger])).toEqual([[false, 'api']])

  // The artists, read before the scan, are read again.
  await page.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: 'Artists' }).click()
  await expect(page.getByRole('main').getByRole('link', { name: 'Saxon' })).toBeVisible()
})

test('a scan already running (the nightly one) shows, and another one waits for it', async ({ page, signIn, api }) => {
  api.addScan({ trigger: 'schedule', full: true })
  await signIn()
  await page.goto('/admin/library')

  await expect(page.getByRole('region', { name: 'Latest scan' })).toContainText(/Full scan (waiting to start|running)/)
  await expect(page.getByRole('region', { name: 'Latest scan' })).toContainText('Nightly')
  await expect(page.getByRole('button', { name: 'Full scan' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Scan now' })).toBeEnabled({ timeout: SCAN_TIMEOUT })
})

test('an account that is not an administrator has no Library page', async ({ page, api: _api }) => {
  await page.goto('/login')
  await fillSignIn(page, OTHER.username, OTHER.password)
  await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible()
  await accountButton(page).click()
  await expect(page.getByRole('menuitem', { name: 'Library' })).toHaveCount(0)

  await page.goto('/admin/library')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
