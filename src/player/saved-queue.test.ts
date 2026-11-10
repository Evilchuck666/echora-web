import { describe, expect, it } from 'vitest'
import { MAX_SAVED, readSavedQueue, writeSavedQueue } from './saved-queue'
import type { PlayerTrack, QueueEntry } from './store'

const track = (id: string): PlayerTrack => ({
  id,
  title: `Song ${id}`,
  durationMs: 180_000,
  streamUrl: `https://localhost/api/tracks/${id}/stream?_hash=x`,
  opusStreamUrl: `https://localhost/api/tracks/${id}/stream/opus?_hash=x`,
  hasLyrics: true,
  favourite: false,
  artist: { id: 'artist', name: 'Band' },
  album: { id: 'album', title: 'Record', coverUrl: 'https://localhost/api/albums/album/cover?_hash=x' },
})
const entries = (count: number): QueueEntry[] => Array.from({ length: count }, (_, i) => ({ key: `k${i + 1}`, track: track(String(i + 1)) }))

describe('the saved queue', () => {
  it('keeps the tracks, their order, the current one and the position, but not the stream URLs', () => {
    const queue = entries(3)
    writeSavedQueue({ queue, unshuffled: [queue[2], queue[0], queue[1]], index: 1, origin: 'album:x', currentTime: 42 })

    const saved = readSavedQueue()!

    expect(saved.tracks.map((t) => t.id)).toEqual(['1', '2', '3'])
    expect(saved.unshuffledOrder).toEqual([2, 0, 1])
    expect(saved).toMatchObject({ index: 1, origin: 'album:x', currentTime: 42 })
    expect(saved.tracks[0]).not.toHaveProperty('streamUrl')
    expect(saved.tracks[0]).not.toHaveProperty('opusStreamUrl')
    expect(saved.tracks[0].album?.coverUrl).toContain('/cover')
  })

  it(`keeps at most ${MAX_SAVED} tracks: 100 before the current one, the rest to come`, () => {
    const queue = entries(5000)
    writeSavedQueue({ queue, unshuffled: queue, index: 700, origin: 'library', currentTime: 0 })

    const saved = readSavedQueue()!

    expect(saved.tracks).toHaveLength(MAX_SAVED)
    expect(saved.tracks[0].id).toBe('601')
    expect(saved.tracks[saved.index].id).toBe('701')
    expect(saved.tracks.at(-1)?.id).toBe('1600')
    expect(saved.unshuffledOrder).toHaveLength(MAX_SAVED)
  })

  it('with fewer tracks to come, keeps more of the ones before', () => {
    const queue = entries(1500)
    writeSavedQueue({ queue, unshuffled: queue, index: 700, origin: 'library', currentTime: 0 })

    const saved = readSavedQueue()!

    expect(saved.tracks).toHaveLength(MAX_SAVED)
    expect(saved.tracks[0].id).toBe('501')
    expect(saved.tracks[saved.index].id).toBe('701')
    expect(saved.tracks.at(-1)?.id).toBe('1500')
  })

  it('near the end of a long queue, keeps the last tracks', () => {
    const queue = entries(1500)
    writeSavedQueue({ queue, unshuffled: queue, index: 1490, origin: null, currentTime: 0 })

    const saved = readSavedQueue()!

    expect(saved.tracks.at(-1)?.id).toBe('1500')
    expect(saved.tracks[saved.index].id).toBe('1491')
  })

  it('ignores what it can not use', () => {
    for (const stored of ['not json', '{"version":99,"tracks":[{}],"index":0}', '{"version":1,"tracks":[],"index":0}', '{"version":1,"tracks":[{}],"index":3}']) {
      localStorage.setItem('echora.queue', stored)
      expect(readSavedQueue()).toBeUndefined()
    }
  })
})
