import { afterEach, beforeEach, vi } from 'vitest'

// openapi-fetch keeps the fetch it finds when a client is created, at import time: give it this mock, configured by
// each test with vi.mocked(fetch).mockImplementation(...) or the helpers in ./http.ts.
globalThis.fetch = vi.fn<typeof fetch>(() => Promise.reject(new Error('Unexpected request: mock fetch in the test')))

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.mocked(fetch).mockReset()
  vi.mocked(fetch).mockImplementation(() => Promise.reject(new Error('Unexpected request: mock fetch in the test')))
})
