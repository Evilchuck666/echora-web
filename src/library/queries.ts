import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'

// Collections come 30 items per page; `view.next` links to the next one and is absent on the last page.

/** The page number of a collection's `view.next` link, or `undefined` on the last page. */
export function nextPage(view?: { next?: string | null }): number | undefined {
  return pageNumber(view?.next)
}

/** Relations are filtered by IRI: /api/albums?artist=/api/artists/{id}. */
export const artistIri = (id: string) => `/api/artists/${id}`
export const albumIri = (id: string) => `/api/albums/${id}`

/** Every artist, by name. */
export function useArtists() {
  return useInfiniteQuery({
    queryKey: ['artists'],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/artists', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

export function useArtist(id: string) {
  return useQuery({
    queryKey: ['artist', id],
    queryFn: () => unwrap(api.GET('/api/artists/{id}', { params: { path: { id } } })),
  })
}

/** The albums of an artist, by year. */
export function useArtistAlbums(artistId: string) {
  return useInfiniteQuery({
    queryKey: ['albums', { artist: artistId }],
    queryFn: ({ pageParam }) =>
      unwrap(api.GET('/api/albums', { params: { query: { page: pageParam, artist: artistIri(artistId) } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

/** Every album of the library, by year and title (the API's order). */
export function useAlbums() {
  return useInfiniteQuery({
    queryKey: ['albums'],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/albums', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

/** Every track of the library, in its order: album artists by name, their albums by year, disc and track number. */
export function useTracks() {
  return useInfiniteQuery({
    queryKey: ['tracks'],
    queryFn: ({ pageParam }) => fetchTracksPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

export function useAlbum(id: string) {
  return useQuery({
    queryKey: ['album', id],
    queryFn: () => unwrap(api.GET('/api/albums/{id}', { params: { path: { id } } })),
  })
}

/** The tracks of an album, by disc and track number. */
export function useAlbumTracks(albumId: string) {
  return useInfiniteQuery({
    queryKey: ['tracks', { album: albumId }],
    queryFn: ({ pageParam }) =>
      unwrap(api.GET('/api/tracks', { params: { query: { page: pageParam, album: albumIri(albumId) } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

/** The page number in a collection's link (`view.next`, `view.last`...), if it has a usable one. */
export function pageNumber(link?: string | null): number | undefined {
  if (!link) {
    return undefined
  }
  const page = Number(new URL(link, 'http://localhost').searchParams.get('page'))
  return Number.isInteger(page) && page > 0 ? page : undefined
}

type TrackFilter = { album: string } | { albumArtist: string } | Record<string, never>

/** One page of tracks, in the order of the library (album artist, album, disc and track number); none filtered. */
export function fetchTracksPage(page: number, filter: TrackFilter = {}) {
  return unwrap(api.GET('/api/tracks', { params: { query: { ...filter, page } } }))
}

/**
 * Every track of an album (`album`) or of an artist's albums (`albumArtist`, album after album), loading every
 * page: to queue them all at once.
 */
export async function fetchAllTracks(filter: { album: string } | { albumArtist: string }) {
  const tracks = []
  let page: number | undefined = 1
  while (page !== undefined) {
    const result = await fetchTracksPage(page, filter)
    tracks.push(...result.member)
    page = nextPage(result.view)
  }
  return tracks
}

/** At most this many artists, albums and tracks come back from a search: the API's maximum. */
export const SEARCH_LIMIT = 50

/**
 * Artists, albums and tracks matching `query`, ranked by the API (every word, in any order, ignoring case and
 * accents). While a new query loads, the previous results stay on screen.
 */
export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => unwrap(api.GET('/api/search', { params: { query: { q: query, limit: SEARCH_LIMIT } } })),
    enabled: query !== '',
    placeholderData: keepPreviousData,
  })
}

/**
 * The lyrics of a track, lines separated by \n, or `null` when its tags have none. Lists only say `hasLyrics`: the
 * lyrics come with the track itself (GET /api/tracks/{id}). They don't change while the app is open.
 */
export function useLyrics(trackId: string | undefined) {
  return useQuery({
    queryKey: ['track', trackId],
    queryFn: () => unwrap(api.GET('/api/tracks/{id}', { params: { path: { id: trackId! } } })),
    select: (track) => track.lyrics ?? null,
    enabled: trackId !== undefined,
    staleTime: Infinity,
  })
}
