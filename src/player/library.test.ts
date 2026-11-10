import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '../components/toast'
import { json, routes } from '../test/http'
import { playQueue, stop, toggleShuffle } from './engine'
import { LIBRARY, playLibrary } from './library'
import { selectCurrentTrack, usePlayer } from './store'

/**
 * A library of `pages` pages of 2 tracks: "p1-a", "p1-b", "p2-a"... in the API's order. A page in `held` is only
 * answered once its promise resolves.
 */
function library(pages: number, held: Record<number, Promise<unknown>> = {}) {
  const requested: number[] = []
  routes({
    'GET /api/tracks': async (request) => {
      const page = Number(new URL(request.url).searchParams.get('page'))
      requested.push(page)
      await held[page]
      const link = (p: number) => `/api/tracks?page=${p}`
      return json({
        member: ['a', 'b'].map((letter) => ({ id: `p${page}-${letter}`, title: `p${page}-${letter}`, streamUrl: `https://localhost/s/p${page}-${letter}` })),
        totalItems: pages * 2,
        view: pages > 1 ? { first: link(1), last: link(pages), ...(page < pages ? { next: link(page + 1) } : {}) } : {},
      })
    },
  })
  return requested
}

const queueIds = () => usePlayer.getState().queue.map((entry) => entry.track.id)
const inOrder = (pages: number) => Array.from({ length: pages }, (_, i) => [`p${i + 1}-a`, `p${i + 1}-b`]).flat()

beforeEach(() => {
  stop()
  usePlayer.setState({ shuffle: false, repeat: 'off' })
  useToast.setState({ message: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('playing the whole library', () => {
  it('in order: starts with the first page, and the others join the queue', async () => {
    library(3)

    await playLibrary()

    expect(queueIds()).toEqual(inOrder(3))
    expect(usePlayer.getState()).toMatchObject({ index: 0, origin: LIBRARY })
    expect(selectCurrentTrack(usePlayer.getState())?.id).toBe('p1-a')
  })

  it('shuffled: starts on a random page, and every track is queued, in any order', async () => {
    toggleShuffle()
    // Every random pick at 60 %: the third page of four, then its second track.
    vi.spyOn(Math, 'random').mockReturnValue(0.6)
    const requested = library(4)

    await playLibrary()

    expect(requested.slice(0, 2)).toEqual([1, 3])
    expect(selectCurrentTrack(usePlayer.getState())?.id).toBe('p3-b')
    expect([...queueIds()].sort()).toEqual(inOrder(4).sort())
    // Each page was asked for once.
    expect([...requested].sort()).toEqual([1, 2, 3, 4])
  })

  it('stops loading when another queue starts meanwhile', async () => {
    let release = () => {}
    const requested = library(3, { 2: new Promise<void>((resolve) => (release = resolve)) })
    const loading = playLibrary()
    await vi.waitFor(() => expect(requested).toEqual([1, 2]))
    expect(usePlayer.getState().origin).toBe(LIBRARY)

    playQueue([{ id: 'other', title: 'Other', streamUrl: 'https://localhost/s/other' }])
    release()
    await loading

    expect(queueIds()).toEqual(['other'])
    expect(requested).toEqual([1, 2])
  })

  it('says so when the library is empty', async () => {
    routes({ 'GET /api/tracks': () => json({ member: [], totalItems: 0 }) })

    await playLibrary()

    expect(usePlayer.getState().index).toBe(-1)
    expect(useToast.getState().message).toBe('The library is empty.')
  })

  it('says so when the library can not be loaded', async () => {
    routes({ 'GET /api/tracks': () => json({ title: 'Server error' }, 500) })

    await playLibrary()

    expect(usePlayer.getState().index).toBe(-1)
    expect(useToast.getState().message).toBe("Couldn't load the whole library.")
  })
})
