import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'

// Collections come 30 items per page; `view.next` links to the next one and is absent on the last page.

/** The page number of a collection's `view.next` link, or `undefined` on the last page. */
export function nextPage(view?: { next?: string | null }): number | undefined {
  if (!view?.next) {
    return undefined
  }
  const page = Number(new URL(view.next, 'http://localhost').searchParams.get('page'))
  return Number.isInteger(page) && page > 0 ? page : undefined
}

/** Relations are filtered by IRI: /api/albums?artist=/api/artists/{id}. */
const artistIri = (id: string) => `/api/artists/${id}`
const albumIri = (id: string) => `/api/albums/${id}`

/** Artists by name; `name` filters by a part of it, case-insensitive. */
export function useArtists(name: string) {
  return useInfiniteQuery({
    queryKey: ['artists', { name }],
    queryFn: ({ pageParam }) =>
      unwrap(api.GET('/api/artists', { params: { query: { page: pageParam, name: name || undefined } } })),
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
