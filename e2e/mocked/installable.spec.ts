import { expect, test } from '../support/fixtures.ts'

// The service worker itself only runs in a production build (src/main.tsx); these tests run on Vite's dev server.
// What makes the app installable is checked here: the manifest the page names, and its icons.
test('the page names a manifest whose icons exist', async ({ page, api: _api }) => {
  await page.goto('/login')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/manifest.json')

  const manifest = (await (await page.request.get(href!)).json()) as { name: string; start_url: string; display: string; icons: { src: string; sizes: string; purpose: string }[] }
  expect(manifest).toMatchObject({ name: 'Echora', start_url: '/', display: 'standalone' })
  // Chromium wants a 192 and a 512 px icon; Android a maskable one.
  expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']))
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  for (const src of [...manifest.icons.map((icon) => icon.src), apple!]) {
    const response = await page.request.get(src)
    expect(response.status(), src).toBe(200)
    expect(response.headers()['content-type'], src).toBe('image/png')
  }
})
