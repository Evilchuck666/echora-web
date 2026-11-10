import { useInfiniteQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { api, unwrap, unwrapEmpty } from '../api/client'
import { queryClient } from '../app/query-client'
import { useSession } from '../auth/tokens'
import { showToast } from '../components/toast'
import { nextPage } from './queries'

// Favourite tracks, albums and artists of the signed-in user. Every track, album and artist the API returns says
// whether it is one (`favourite`); what the user changes during the visit is kept here and wins over that, so every
// heart on screen (a list, the album page, the player) follows at once without fetching the lists again.

export type FavouriteKind = 'track' | 'album' | 'artist'

/** Changes made during this visit, by "kind:id". Forgotten on sign-out. */
const useChanges = create<Record<string, boolean | undefined>>()(() => ({}))

const changeKey = (kind: FavouriteKind, id: string) => `${kind}:${id}`

useSession.subscribe((session, previous) => {
  if (previous.signedIn && !session.signedIn) {
    useChanges.setState({}, true)
  }
})

/** What the user made of an item during this visit (undefined: nothing, the API's `favourite` holds). */
export function changedFavourite(kind: FavouriteKind, id: string): boolean | undefined {
  return useChanges.getState()[changeKey(kind, id)]
}

/** Whether an item is a favourite: as changed during this visit, else as the API said (`fromApi`). */
export function useIsFavourite(kind: FavouriteKind, id: string | undefined, fromApi: boolean | undefined): boolean {
  const changed = useChanges((changes) => (id === undefined ? undefined : changes[changeKey(kind, id)]))
  return changed ?? fromApi ?? false
}

function send(kind: FavouriteKind, id: string, favourite: boolean) {
  const params = { params: { path: { id } } }
  switch (kind) {
    case 'track':
      return favourite ? api.PUT('/api/tracks/{id}/favourite', params) : api.DELETE('/api/tracks/{id}/favourite', params)
    case 'album':
      return favourite ? api.PUT('/api/albums/{id}/favourite', params) : api.DELETE('/api/albums/{id}/favourite', params)
    case 'artist':
      return favourite ? api.PUT('/api/artists/{id}/favourite', params) : api.DELETE('/api/artists/{id}/favourite', params)
  }
}

/**
 * Adds an item to the favourites or removes it. The hearts change at once; if the API refuses, they change back and
 * a toast says so. `name` is what the toast calls it.
 */
export async function setFavourite(kind: FavouriteKind, id: string, favourite: boolean, name: string): Promise<void> {
  const key = changeKey(kind, id)
  const before = useChanges.getState()[key]
  useChanges.setState({ [key]: favourite })
  try {
    await unwrapEmpty(send(kind, id, favourite))
    // The list of favourites is out of date: fetched again the next time it is shown, not now, so the page on
    // screen keeps what was just removed, and it can be put back.
    void queryClient.invalidateQueries({ queryKey: ['favourites', kind], refetchType: 'none' })
  } catch {
    useChanges.setState({ [key]: before })
    showToast(favourite ? `Couldn't add “${name}” to your favourites.` : `Couldn't remove “${name}” from your favourites.`)
  }
}


export function useFavouriteTracks() {
  return useInfiniteQuery({
    queryKey: ['favourites', 'track'],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/favourites/tracks', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

export function useFavouriteAlbums() {
  return useInfiniteQuery({
    queryKey: ['favourites', 'album'],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/favourites/albums', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

export function useFavouriteArtists() {
  return useInfiniteQuery({
    queryKey: ['favourites', 'artist'],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/favourites/artists', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

/** Every favourite track, newest first, loading every page: to play them all. */
export async function fetchAllFavouriteTracks() {
  const tracks = []
  let page: number | undefined = 1
  while (page !== undefined) {
    const result = await unwrap(api.GET('/api/favourites/tracks', { params: { query: { page } } }))
    tracks.push(...result.member)
    page = nextPage(result.view)
  }
  return tracks
}
