import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTokens, writeTokens } from '../auth/tokens'
import { calls, json, jwt, routes } from '../test/http'
import {
  addToQueue,
  cycleRepeat,
  jumpTo,
  moveInQueue,
  next,
  playNext,
  playQueue,
  previous,
  removeFromQueue,
  seek,
  setVolume,
  stop,
  toggleMute,
  togglePlay,
  toggleShuffle,
} from './engine'
import { selectCurrentTrack, selectHasNext, selectUpcoming, usePlayer, type PlayerTrack } from './store'

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

const ids = (entries: { track: PlayerTrack }[]) => entries.map((entry) => entry.track.id)
const queueIds = () => ids(usePlayer.getState().queue)
const currentId = () => selectCurrentTrack(usePlayer.getState())?.id
const upcomingIds = () => ids(selectUpcoming(usePlayer.getState()))
const many = (count: number) => Array.from({ length: count }, (_, i) => track(String(i + 1)))

beforeEach(() => {
  stop()
  usePlayer.setState({ volume: 1, muted: false, shuffle: false, repeat: 'off' })
})

describe('playing', () => {
  it('plays a queue from the chosen track', async () => {
    playQueue(album, { startIndex: 1 })

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
    playQueue(album, { startIndex: 1 })
    next()
    await vi.waitFor(() => expect(usePlayer.getState().index).toBe(2))

    next()
    expect(usePlayer.getState().index).toBe(2)
  })

  it('goes back to the start of the track after a few seconds of it, to the previous track before', async () => {
    playQueue(album, { startIndex: 1 })
    await vi.waitFor(() => expect(audio().src).toBe(album[1].streamUrl))

    audio().currentTime = 42
    previous()
    expect(usePlayer.getState().index).toBe(1)
    expect(audio().currentTime).toBe(0)

    previous()
    await vi.waitFor(() => expect(usePlayer.getState().index).toBe(0))
  })

  it('plays the next track when one ends, and stops at the end of the queue', async () => {
    playQueue(album, { startIndex: 1 })
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

describe('the queue', () => {
  it('plays next: right after the current track, in their order', () => {
    playQueue(album)
    playNext([track('a'), track('b')])

    expect(queueIds()).toEqual(['1', 'a', 'b', '2', '3'])
    expect(currentId()).toBe('1')
  })

  it('adds to the end', () => {
    playQueue(album)
    addToQueue([track('a')])

    expect(queueIds()).toEqual(['1', '2', '3', 'a'])
  })

  it('loads what is added to an empty queue without playing it', () => {
    addToQueue([track('a'), track('b')])

    expect(usePlayer.getState()).toMatchObject({ index: 0, playing: false, duration: 180 })
    expect(currentId()).toBe('a')
    expect(audio().getAttribute('src')).toBeNull()

    togglePlay()
    expect(audio().src).toBe(streamUrl('a'))
  })

  it('tells apart the same track queued twice', () => {
    playQueue(album)
    addToQueue([track('2')])
    const [, second, , again] = usePlayer.getState().queue

    removeFromQueue(again.key)
    expect(queueIds()).toEqual(['1', '2', '3'])
    expect(usePlayer.getState().queue[1].key).toBe(second.key)
  })

  it('jumps to a track, and the ones skipped count as played', async () => {
    playQueue(album)
    jumpTo(usePlayer.getState().queue[2].key)

    await vi.waitFor(() => expect(audio().src).toBe(album[2].streamUrl))
    expect(usePlayer.getState().index).toBe(2)
    expect(upcomingIds()).toEqual([])
  })

  it('removes a track but never the current one', () => {
    playQueue(album, { startIndex: 1 })
    const [first, current, last] = usePlayer.getState().queue

    removeFromQueue(current.key)
    expect(queueIds()).toEqual(['1', '2', '3'])

    removeFromQueue(first.key)
    expect(queueIds()).toEqual(['2', '3'])
    expect(currentId()).toBe('2')
    removeFromQueue(last.key)
    expect(queueIds()).toEqual(['2'])
  })

  it('moves a track, and the current one stays current', () => {
    playQueue(many(4))
    const [, , third, fourth] = usePlayer.getState().queue

    moveInQueue(fourth.key, 1)
    expect(queueIds()).toEqual(['1', '4', '2', '3'])
    moveInQueue(third.key, 0)
    expect(queueIds()).toEqual(['3', '1', '4', '2'])
    expect(currentId()).toBe('1')
    expect(usePlayer.getState().index).toBe(1)
  })
})

describe('shuffle', () => {
  it('shuffles the tracks after the current one, and turning it off puts them back in order', () => {
    playQueue(many(30), { startIndex: 4 })

    toggleShuffle()
    expect(usePlayer.getState().shuffle).toBe(true)
    expect(queueIds().slice(0, 5)).toEqual(['1', '2', '3', '4', '5'])
    expect(upcomingIds()).not.toEqual(many(30).slice(5).map((t) => t.id))
    expect([...upcomingIds()].sort()).toEqual(many(30).slice(5).map((t) => t.id).sort())

    toggleShuffle()
    expect(queueIds()).toEqual(many(30).map((t) => t.id))
    expect(currentId()).toBe('5')
  })

  it('starts a shuffled queue on a random track, or on the one chosen', () => {
    toggleShuffle()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    playQueue(album)
    expect(currentId()).toBe('3')
    vi.restoreAllMocks()

    playQueue(album, { startIndex: 1 })
    expect(currentId()).toBe('2')
    expect(usePlayer.getState().index).toBe(0)
  })

  it('keeps tracks added while shuffled when it is turned off', () => {
    toggleShuffle()
    playQueue(album, { startIndex: 0 })
    playNext([track('a')])
    addToQueue([track('z')])
    expect(upcomingIds()[0]).toBe('a')

    toggleShuffle()
    expect(queueIds()).toEqual(['1', 'a', '2', '3', 'z'])
  })

  it('is remembered', () => {
    toggleShuffle()

    expect(JSON.parse(localStorage.getItem('echora.player') ?? '{}').state.shuffle).toBe(true)
  })
})

describe('repeat', () => {
  it('goes off, all, one and off again, and is remembered', () => {
    cycleRepeat()
    expect(usePlayer.getState().repeat).toBe('all')
    cycleRepeat()
    expect(usePlayer.getState().repeat).toBe('one')
    expect(JSON.parse(localStorage.getItem('echora.player') ?? '{}').state.repeat).toBe('one')
    cycleRepeat()
    expect(usePlayer.getState().repeat).toBe('off')
  })

  it('all: after the last track comes the first, also with Next', async () => {
    cycleRepeat()
    playQueue(album, { startIndex: 2 })
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))
    expect(selectHasNext(usePlayer.getState())).toBe(true)

    audio().dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(audio().src).toBe(album[0].streamUrl))

    playQueue(album, { startIndex: 2 })
    next()
    await vi.waitFor(() => expect(usePlayer.getState().index).toBe(0))
  })

  it('one: the track starts again when it ends, but Next still moves on', async () => {
    cycleRepeat()
    cycleRepeat()
    playQueue(album)
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true))

    audio().currentTime = 179
    audio().dispatchEvent(new Event('ended'))
    expect(audio().currentTime).toBe(0)
    expect(currentId()).toBe('1')

    next()
    await vi.waitFor(() => expect(currentId()).toBe('2'))
  })
})

describe('stream URLs', () => {
  it('fetches the track again for a URL about to expire', async () => {
    routes({ 'GET /api/tracks/1': () => json({ id: '1', streamUrl: streamUrl('1', inHours(6), 'renewed') }) })

    playQueue([track('1', streamUrl('1', Math.floor(Date.now() / 1000) + 30))])

    await vi.waitFor(() => expect(audio().src).toContain('_hash=renewed'))
    expect(usePlayer.getState().queue[0].track.streamUrl).toContain('_hash=renewed')
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
    expect(JSON.parse(localStorage.getItem('echora.player') ?? '{}').state).toEqual({ volume: 0.3, muted: false, shuffle: false, repeat: 'off' })
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
