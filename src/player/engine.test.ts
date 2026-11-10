import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTokens, writeTokens } from '../auth/tokens'
import { calls, json, jwt, routes } from '../test/http'
import { next, playQueue, previous, seek, setVolume, stop, toggleMute, togglePlay } from './engine'
import { selectCurrentTrack, usePlayer, type PlayerTrack } from './store'

// The engine's audio element, caught when the engine module creates it.
const created = vi.hoisted(() => {
  const elements: HTMLAudioElement[] = []
  const Original = globalThis.Audio
  globalThis.Audio = class extends Original {
    constructor(src?: string) {
      super(src)
      elements.push(this)
    }
  } as typeof Audio
  return elements
})
const audio = () => created[0]

const inHours = (hours: number) => Math.floor(Date.now() / 1000) + hours * 3600
const streamUrl = (id: string, expiresAt = inHours(6), hash = 'sig') =>
  `https://localhost/api/tracks/${id}/stream?_expiration=${expiresAt}&_hash=${hash}`
const track = (id: string, url = streamUrl(id)): PlayerTrack => ({
  id,
  title: `Song ${id}`,
  durationMs: 180_000,
  streamUrl: url,
  artist: { id: 'artist', name: 'Band' },
  album: { id: 'album', title: 'Record', coverUrl: null },
})
const album = [track('1'), track('2'), track('3')]

beforeEach(() => {
  stop()
  usePlayer.setState({ volume: 1, muted: false })
})

describe('playing', () => {
  it('plays a queue from the chosen track', async () => {
    playQueue(album, 1)

    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))
    expect(selectCurrentTrack(usePlayer.getState())?.id).toBe('2')
    expect(audio().src).toBe(album[1].streamUrl)
    expect(usePlayer.getState().duration).toBe(180)
  })

  it('pauses and resumes', async () => {
    playQueue(album)
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))

    togglePlay()
    expect(usePlayer.getState().playing).toBe(false)
    togglePlay()
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))
  })

  it('does nothing with an empty queue', () => {
    playQueue([])

    expect(usePlayer.getState().index).toBe(-1)
  })
})

describe('moving in the queue', () => {
  it('goes to the next track, not beyond the last', async () => {
    playQueue(album, 1)
    next()
    await vi.waitFor(() => expect(usePlayer.getState().index).toBe(2))

    next()
    expect(usePlayer.getState().index).toBe(2)
  })

  it('goes back to the start of the track after a few seconds of it, to the previous track before', async () => {
    playQueue(album, 1)
    await vi.waitFor(() => expect(audio().src).toBe(album[1].streamUrl))

    audio().currentTime = 42
    previous()
    expect(usePlayer.getState().index).toBe(1)
    expect(audio().currentTime).toBe(0)

    previous()
    await vi.waitFor(() => expect(usePlayer.getState().index).toBe(0))
  })

  it('plays the next track when one ends, and stops at the end of the queue', async () => {
    playQueue(album, 1)
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))

    audio().dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(audio().src).toBe(album[2].streamUrl))

    audio().pause()
    audio().dispatchEvent(new Event('ended'))
    expect(usePlayer.getState()).toMatchObject({ index: 2, playing: false, currentTime: 0 })
  })

  it('keeps a seek within the track', async () => {
    playQueue(album)
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))

    seek(500)
    expect(usePlayer.getState().currentTime).toBe(180)
    seek(-5)
    expect(usePlayer.getState().currentTime).toBe(0)
  })
})

describe('stream URLs', () => {
  it('fetches the track again for a URL about to expire', async () => {
    routes({ 'GET /api/tracks/1': () => json({ id: '1', streamUrl: streamUrl('1', inHours(6), 'renewed') }) })

    playQueue([track('1', streamUrl('1', Math.floor(Date.now() / 1000) + 30))])

    await vi.waitFor(() => expect(audio().src).toContain('_hash=renewed'))
    expect(usePlayer.getState().queue[0].streamUrl).toContain('_hash=renewed')
  })

  it('recovers from an expired URL where the track was', async () => {
    routes({ 'GET /api/tracks/1': () => json({ id: '1', streamUrl: streamUrl('1', inHours(6), 'renewed') }) })
    playQueue([track('1')])
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))
    usePlayer.setState({ currentTime: 61 })

    audio().dispatchEvent(new Event('error'))

    await vi.waitFor(() => expect(audio().src).toContain('_hash=renewed'))
    expect(audio().currentTime).toBe(61)
    expect(usePlayer.getState().error).toBeNull()
  })

  it('gives up after one retry', async () => {
    routes({ 'GET /api/tracks/1': () => json({ id: '1', streamUrl: streamUrl('1', inHours(6), 'renewed') }) })
    playQueue([track('1')])
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))

    audio().dispatchEvent(new Event('error'))
    await vi.waitFor(() => expect(audio().src).toContain('_hash=renewed'))
    audio().dispatchEvent(new Event('error'))

    await vi.waitFor(() => expect(usePlayer.getState().error).toBe("Couldn't play this track."))
    expect(usePlayer.getState().playing).toBe(false)
    expect((await calls()).length).toBe(1)
  })
})

describe('volume', () => {
  it('is applied to the audio and remembered', () => {
    setVolume(0.3)

    expect(audio().volume).toBe(0.3)
    expect(JSON.parse(localStorage.getItem('echora.player') ?? '{}').state).toEqual({ volume: 0.3, muted: false })
  })

  it('stays between 0 and 1, and 0 means muted', () => {
    setVolume(4)
    expect(usePlayer.getState().volume).toBe(1)
    setVolume(-1)
    expect(usePlayer.getState()).toMatchObject({ volume: 0, muted: true })
  })

  it('comes back up when unmuting from 0', () => {
    setVolume(0)
    toggleMute()
    expect(usePlayer.getState()).toMatchObject({ volume: 0.5, muted: false })

    toggleMute()
    expect(audio().muted).toBe(true)
  })
})

describe('signing out', () => {
  it('stops the music and empties the queue', async () => {
    writeTokens({ token: jwt(3600), refreshToken: 'refresh', refreshTokenExpiresAt: inHours(720) })
    playQueue(album)
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))

    clearTokens()

    expect(usePlayer.getState()).toMatchObject({ queue: [], index: -1, playing: false })
    expect(audio().getAttribute('src')).toBeNull()
  })
})
