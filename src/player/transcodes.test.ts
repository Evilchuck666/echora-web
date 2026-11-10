import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTokens, writeTokens } from '../auth/tokens'
import { calls, json, jwt, routes } from '../test/http'
import { usePlayer, type PlayerTrack, type QueueEntry } from './store'
import { DEBOUNCE_MS, deviceId, MAX_TRACKS, tracksToPrepare } from './transcodes'

const flac = (id: string): PlayerTrack => ({ id, title: id, format: 'flac', opusStreamUrl: `https://localhost/api/tracks/${id}/stream/opus` })
const mp3 = (id: string): PlayerTrack => ({ id, title: id, format: 'mp3', opusStreamUrl: null })
const entries = (tracks: PlayerTrack[]): QueueEntry[] => tracks.map((track, i) => ({ key: `k${i}`, track }))

/** Node's setImmediate (the tests run on Node): not faked, unlike setTimeout, and not in the browser's types. */
const nextTask = (globalThis as unknown as { setImmediate: (callback: () => void) => void }).setImmediate

/** Lets any request under way reach fetch. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => nextTask(resolve))
  }
}

/** What the API received, in order. */
async function sent(): Promise<{ device: string; tracks: string[] }[]> {
  return (await calls()).filter((call) => call.url.endsWith('/api/transcodes')).map((call) => JSON.parse(call.body))
}

function setQueue(tracks: PlayerTrack[], index = 0) {
  usePlayer.setState({ queue: entries(tracks), unshuffled: entries(tracks), index })
}

beforeEach(() => {
  // Signing out and in again forgets what was sent last.
  clearTokens()
  writeTokens({ token: jwt(3600), refreshToken: 'refresh', refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 86400 })
  usePlayer.setState({ queue: [], unshuffled: [], index: -1, repeat: 'off', quality: 'data-saver' })
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((type) => (type.includes('opus') ? 'probably' : ''))
  routes({ 'POST /api/transcodes': () => json({ queued: [], ready: [], converting: [] }, 202) })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the device id', () => {
  it('is a UUID made once and kept, also after signing out', () => {
    const id = deviceId()

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    clearTokens()
    expect(deviceId()).toBe(id)
  })
})

describe('the tracks to prepare', () => {
  it('are the next ones with an Opus version, each once, in order, at most 20', () => {
    const tracks = [flac('now'), flac('a'), mp3('b'), flac('c'), flac('a'), ...Array.from({ length: 30 }, (_, i) => flac(`x${i}`))]
    usePlayer.setState({ queue: entries(tracks), index: 0, repeat: 'off', quality: 'data-saver' })

    const ids = tracksToPrepare(usePlayer.getState())

    expect(ids.slice(0, 3)).toEqual(['a', 'c', 'x0'])
    expect(ids).toHaveLength(MAX_TRACKS)
    expect(ids).not.toContain('now')
    expect(ids).not.toContain('b')
  })

  it('go on from the top when repeating the queue', () => {
    usePlayer.setState({ queue: entries([flac('a'), flac('b'), flac('c')]), index: 1, repeat: 'all', quality: 'data-saver' })

    expect(tracksToPrepare(usePlayer.getState())).toEqual(['c', 'a'])
  })

  it('include FLAC tracks of a queue kept from an earlier visit, which have no URLs', () => {
    usePlayer.setState({ queue: entries([flac('now'), { id: 'kept', format: 'flac' }]), index: 0, repeat: 'off', quality: 'data-saver' })

    expect(tracksToPrepare(usePlayer.getState())).toEqual(['kept'])
  })
})

describe('asking the API', () => {
  it('sends the next tracks once the queue settles, with the device', async () => {
    setQueue([flac('now'), flac('a')])
    setQueue([flac('now'), flac('a'), flac('b')])
    vi.advanceTimersByTime(DEBOUNCE_MS - 1)
    expect(await sent()).toEqual([])

    vi.advanceTimersByTime(1)

    await vi.waitFor(async () => expect(await sent()).toEqual([{ device: deviceId(), tracks: ['a', 'b'] }]))
  })

  it("doesn't send the same list twice", async () => {
    setQueue([flac('now'), flac('a')])
    vi.advanceTimersByTime(DEBOUNCE_MS)
    await vi.waitFor(async () => expect(await sent()).toHaveLength(1))

    // Another queue with the same tracks to come (e.g. a reorder before them).
    setQueue([flac('now'), flac('a')])
    vi.advanceTimersByTime(DEBOUNCE_MS)

    await settle()
    expect(await sent()).toHaveLength(1)
  })

  it('cancels the list once when the data saver is turned off', async () => {
    setQueue([flac('now'), flac('a')])
    vi.advanceTimersByTime(DEBOUNCE_MS)
    await vi.waitFor(async () => expect(await sent()).toHaveLength(1))

    usePlayer.setState({ quality: 'original' })
    vi.advanceTimersByTime(DEBOUNCE_MS)
    await vi.waitFor(async () => expect((await sent()).at(-1)?.tracks).toEqual([]))

    setQueue([flac('now'), flac('b')])
    vi.advanceTimersByTime(DEBOUNCE_MS)
    await settle()
    expect(await sent()).toHaveLength(2)
  })

  it('asks nothing without the data saver, or where the browser has no Opus', async () => {
    usePlayer.setState({ quality: 'original' })
    setQueue([flac('now'), flac('a')])
    vi.advanceTimersByTime(DEBOUNCE_MS)

    usePlayer.setState({ quality: 'data-saver' })
    vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue('')
    setQueue([flac('now'), flac('b')])
    vi.advanceTimersByTime(DEBOUNCE_MS)

    await settle()
    expect(await sent()).toEqual([])
  })
})
