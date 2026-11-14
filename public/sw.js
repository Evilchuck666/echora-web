// Echora's service worker: keeps the app itself (index.html and the built assets) so it opens without waiting for
// the network, and opens at all when the server can't be reached (it then says so, as the API can't answer). It never
// touches the API (/api, the music, the covers, the tokens), nor what else the server routes to it: those always go
// to the network, as if there were no service worker.
//
// - Pages (navigations): the network first, so a new version is used as soon as it is deployed; the copy kept from
//   the last visit when the network fails or takes more than NAVIGATION_TIMEOUT_MS.
// - /assets/*: built with a hash in their names, they never change: kept once fetched, served from the copy. When a new
//   index.html arrives, the assets it no longer uses are let go.
// - The icons and the manifest: the copy at once, refreshed in the background.
//
// Plain JavaScript in public/, copied as is to the root of the build: its scope is the whole app.

const CACHE = 'echora-app-v1'
const SHELL = '/index.html'
const NAVIGATION_TIMEOUT_MS = 3000
/** Never handled here: the API and the other paths the server keeps for itself (see the Echora Caddyfile). */
const SERVER_PATHS = ['/api', '/bundles/', '/.well-known/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || SERVER_PATHS.some((path) => url.pathname.startsWith(path))) {
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(page(request))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(request))
  } else if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json' || url.pathname === '/favicon.svg') {
    event.respondWith(refreshed(request, event))
  }
})

/** Every route of the app is index.html (React Router takes it from there): the network's, else the copy. */
async function page(request) {
  const cache = await caches.open(CACHE)
  const network = fetch(request).then(async (response) => {
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      await cache.put(SHELL, response.clone())
      await forgetUnusedAssets(cache, await response.clone().text())
    }
    return response
  })
  const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS))
  try {
    const response = await Promise.race([network, timeout])
    if (response) {
      return response
    }
  } catch {
    // Offline, or the server is down: the copy below.
  }
  const copy = await cache.match(SHELL)
  return copy ?? network
}

async function asset(request) {
  const cache = await caches.open(CACHE)
  const copy = await cache.match(request)
  if (copy) {
    return copy
  }
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
  }
  return response
}

async function refreshed(request, event) {
  const cache = await caches.open(CACHE)
  const copy = await cache.match(request)
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone())
    }
    return response
  })
  if (copy) {
    event.waitUntil(network.catch(() => undefined))
    return copy
  }
  return network
}

/** Lets go of the kept assets the new index.html doesn't name (an older version's); others load again if needed. */
async function forgetUnusedAssets(cache, html) {
  const used = new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname
    if (path.startsWith('/assets/') && !used.has(path)) {
      await cache.delete(request)
    }
  }
}
