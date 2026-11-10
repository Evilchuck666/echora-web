import { describe, expect, it } from 'vitest'
import { json, routes } from '../test/http'
import { fetchAllTracks, nextPage } from './queries'

describe('nextPage', () => {
  it('reads the page number of the next link', () => {
    expect(nextPage({ next: '/api/artists?page=2' })).toBe(2)
    expect(nextPage({ next: '/api/albums?artist=%2Fapi%2Fartists%2F1&page=7' })).toBe(7)
  })

  it('is undefined on the last page', () => {
    expect(nextPage({})).toBeUndefined()
    expect(nextPage({ next: null })).toBeUndefined()
    expect(nextPage(undefined)).toBeUndefined()
  })

  it('ignores a link without a usable page number', () => {
    expect(nextPage({ next: '/api/artists' })).toBeUndefined()
    expect(nextPage({ next: '/api/artists?page=abc' })).toBeUndefined()
    expect(nextPage({ next: '/api/artists?page=0' })).toBeUndefined()
  })
})

describe('fetchAllTracks', () => {
  it('loads every page, keeping the filter', async () => {
    const requested: string[] = []
    routes({
      'GET /api/tracks': (request) => {
        const url = new URL(request.url)
        requested.push(url.search)
        const page = Number(url.searchParams.get('page'))
        return json({
          member: [{ id: `track-${page}` }],
          view: page < 3 ? { next: `/api/tracks?albumArtist=%2Fapi%2Fartists%2Fa&page=${page + 1}` } : {},
        })
      },
    })

    const tracks = await fetchAllTracks({ albumArtist: '/api/artists/a' })

    expect(tracks.map((track) => track.id)).toEqual(['track-1', 'track-2', 'track-3'])
    expect(requested).toEqual([1, 2, 3].map((page) => `?albumArtist=%2Fapi%2Fartists%2Fa&page=${page}`))
  })
})
