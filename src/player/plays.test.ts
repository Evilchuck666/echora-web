import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeTokens } from '../auth/tokens'
import { calls, json, jwt, routes } from '../test/http'
import { trackEnded } from './plays'
import { usePlayer, type QueueEntry } from './store'

// The counter watches the store: these tests move the position as the engine would while the music plays.

const entry = (key: string, id: string, durationMs = 180_000): QueueEntry => ({ key, track: { id, title: `Song ${id}`, durationMs } })

/** Plays on from the current position to `to` seconds, one second at a time (as timeupdate events do). */
function playTo(to: number) {
  for (let t = Math.floor(usePlayer.getState().currentTime) + 1; t <= to; t++) {
    usePlayer.setState({ currentTime: t })
  }
}

/** The tracks the API was told about, in order. */
async function reported(): Promise<string[]> {
  return (await calls()).filter((call) => call.method === 'POST').map((call) => new URL(call.url).pathname.split('/')[3])
}

beforeEach(() => {
  writeTokens({ token: jwt(3600), refreshToken: 'refresh', refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 86400 })
  routes({ 'POST /api/tracks/a/plays': () => new Response(null, { status: 204 }), 'POST /api/tracks/b/plays': () => new Response(null, { status: 204 }) })
  usePlayer.setState({ queue: [entry('1', 'a'), entry('2', 'b')], index: 0, currentTime: 0, duration: 180, playing: true })
})

afterEach(() => {
  vi.useRealTimers()
  usePlayer.setState({ queue: [], index: -1, currentTime: 0, playing: false })
})

describe('counting a play', () => {
  it('counts a track once half of it has played, once, with when', async () => {
    playTo(89)
    expect(await reported()).toEqual([])

    playTo(120)
    await vi.waitFor(async () => expect(await reported()).toEqual(['a']))
    const [call] = await calls()
    expect(Date.parse(JSON.parse(call.body).playedAt)).toBeGreaterThan(Date.now() - 5000)
  })

  it('counts a long track after 4 minutes', async () => {
    usePlayer.setState({ duration: 1200 })
    playTo(239)
    expect(await reported()).toEqual([])
    playTo(240)
    await vi.waitFor(async () => expect(await reported()).toEqual(['a']))
  })

  it("doesn't count what was skipped by seeking, nor time spent paused", async () => {
    playTo(10)
    usePlayer.setState({ currentTime: 170 })
    usePlayer.setState({ playing: false, currentTime: 171 })
    expect(await reported()).toEqual([])
  })

  it('counts a track that ends, however little of it played', async () => {
    playTo(5)
    trackEnded()
    await vi.waitFor(async () => expect(await reported()).toEqual(['a']))
  })

  it('counts again a track played again: repeated, or from its start with Previous', async () => {
    playTo(100)
    usePlayer.setState({ currentTime: 0 })
    playTo(100)
    trackEnded()
    await vi.waitFor(async () => expect(await reported()).toEqual(['a', 'a']))
  })

  it('counts each track of the queue on its own', async () => {
    playTo(100)
    usePlayer.setState({ index: 1, currentTime: 0 })
    playTo(100)
    await vi.waitFor(async () => expect(await reported()).toEqual(['a', 'b']))
  })

  it('tries once more when the API fails, with the same time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let failures = 1
    routes({ 'POST /api/tracks/a/plays': () => (failures-- > 0 ? json({ title: 'Error' }, 503) : new Response(null, { status: 204 })) })

    playTo(100)
    await vi.waitFor(async () => expect(await reported()).toEqual(['a']))
    await vi.advanceTimersByTimeAsync(10_000)

    await vi.waitFor(async () => expect(await reported()).toEqual(['a', 'a']))
    const [first, second] = await calls()
    expect(second.body).toBe(first.body)
  })
})
