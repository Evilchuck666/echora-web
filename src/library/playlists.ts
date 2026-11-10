import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query'
import { api, unwrap, unwrapEmpty } from '../api/client'
import { queryClient } from '../app/query-client'
import { nextPage } from './queries'
import type { Playlist, PlaylistItem } from './types'

// The user's playlists (only theirs: the API answers 404 for anyone else's), in the order the user gave them, the same
// on every device; a new one comes first. Their tracks are items: one appearance of a track each, so a track added
// twice is two items with their own ids. The API keeps both orders; `position` is an index, from 0.

/** The longest name the API accepts, once trimmed. */
export const MAX_NAME = 100

const MERGE_PATCH = { headers: { 'Content-Type': 'application/merge-patch+json' } }

type ItemPages = InfiniteData<{ member: PlaylistItem[] }, number>
type PlaylistPages = InfiniteData<{ member: Playlist[] }, number>

/** The queue (see inOrder) of the moves among the user's playlists, all of which change the same order. */
const PLAYLIST_ORDER = 'order of the playlists'

/** The changes under way for each playlist: the last one's promise, and how many are queued or running. */
const changes = new Map<string, { last: Promise<unknown>; count: number }>()

/**
 * Runs `change` once the earlier changes to the same playlist are done, worked or not. Positions are indexes in the
 * API's current order: a removal sent while a move is under way could reach the API first, and the move would then
 * land one place off.
 */
function inOrder<T>(id: string, change: () => Promise<T>): Promise<T> {
  const queue = changes.get(id) ?? { last: Promise.resolve(), count: 0 }
  // Counted out before the caller hears of it, so it can tell whether other changes are still queued (busy()).
  const result = queue.last
    .catch(() => undefined)
    .then(change)
    .finally(() => {
      if (--queue.count === 0 && changes.get(id) === queue) {
        changes.delete(id)
      }
    })
  queue.last = result
  queue.count++
  changes.set(id, queue)
  return result
}

/** Whether changes to a playlist are queued or running. */
const busy = (id: string) => changes.has(id)

/** Every playlist, in the user's order. */
export function usePlaylists() {
  return useInfiniteQuery({
    queryKey: ['playlists'],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/playlists', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

export function usePlaylist(id: string) {
  return useQuery({
    queryKey: ['playlist', id],
    queryFn: () => unwrap(api.GET('/api/playlists/{id}', { params: { path: { id } } })),
  })
}

/** The items of a playlist, in order. */
export function usePlaylistItems(id: string) {
  return useInfiniteQuery({
    queryKey: ['playlist-items', id],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/playlists/{id}/items', { params: { path: { id }, query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

/** After a change to a playlist: its numbers and covers, the list of playlists (now the latest changed). */
function refresh(id: string, playlist?: Playlist): void {
  if (playlist) {
    queryClient.setQueryData(['playlist', id], playlist)
  } else {
    void queryClient.invalidateQueries({ queryKey: ['playlist', id] })
  }
  void queryClient.invalidateQueries({ queryKey: ['playlists'] })
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const playlist = await unwrap(api.POST('/api/playlists', { body: { name: name.trim() } }))
  void queryClient.invalidateQueries({ queryKey: ['playlists'] })
  return playlist
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  const playlist = await unwrap(api.PATCH('/api/playlists/{id}', { params: { path: { id } }, body: { name: name.trim() }, ...MERGE_PATCH }))
  refresh(id, playlist)
}

export async function deletePlaylist(id: string): Promise<void> {
  await unwrapEmpty(api.DELETE('/api/playlists/{id}', { params: { path: { id } } }))
  queryClient.removeQueries({ queryKey: ['playlist', id] })
  queryClient.removeQueries({ queryKey: ['playlist-items', id] })
  void queryClient.invalidateQueries({ queryKey: ['playlists'] })
}

/** Adds tracks at the end, in their order, all or none; answers the playlist as it is now. */
export async function addToPlaylist(id: string, trackIds: string[]): Promise<Playlist> {
  const playlist = await inOrder(id, () => unwrap(api.POST('/api/playlists/{id}/items', { params: { path: { id } }, body: { tracks: trackIds } })))
  refresh(id, playlist)
  void queryClient.invalidateQueries({ queryKey: ['playlist-items', id] })
  return playlist
}

/**
 * The items of loaded pages with one moved from `from` to `to` (indexes in the whole order), the pages keeping their
 * sizes: what the page shows at once, before the API confirms.
 */
export function moveInPages<T>(pages: T[][], from: number, to: number): T[][] {
  const items = pages.flat()
  const [moved] = items.splice(from, 1)
  items.splice(to, 0, moved)
  let start = 0
  return pages.map((page) => {
    const slice = items.slice(start, start + page.length)
    start += page.length
    return slice
  })
}

function setItemPages(id: string, change: (pages: PlaylistItem[][]) => PlaylistItem[][]): void {
  queryClient.setQueryData<ItemPages>(['playlist-items', id], (data) => {
    if (!data) {
      return data
    }
    const pages = change(data.pages.map((page) => page.member))
    return { ...data, pages: data.pages.map((page, i) => ({ ...page, member: pages[i] })) }
  })
}

/**
 * After a change to the items: read them again (refused, to undo it; done, so the pages still to load start where
 * these end), with the playlist's numbers and covers. Not while other changes are queued: the page shows them already,
 * and reading now would undo them on screen until they are done.
 */
function settle(id: string): void {
  if (!busy(id)) {
    refresh(id)
    void queryClient.invalidateQueries({ queryKey: ['playlist-items', id] })
  }
}

/**
 * Moves a playlist to `to` among the user's playlists; the list shows it at once, then what the API made of it.
 * Moves reach the API one at a time, like the changes to a playlist's items.
 */
export async function movePlaylist(id: string, from: number, to: number): Promise<void> {
  queryClient.setQueryData<PlaylistPages>(['playlists'], (data) => {
    if (!data) {
      return data
    }
    const pages = moveInPages(
      data.pages.map((page) => page.member),
      from,
      to,
    )
    return { ...data, pages: data.pages.map((page, i) => ({ ...page, member: pages[i] })) }
  })
  try {
    await inOrder(PLAYLIST_ORDER, () =>
      unwrap(api.PATCH('/api/playlists/{id}', { params: { path: { id } }, body: { position: to }, ...MERGE_PATCH })),
    )
  } finally {
    // Read again once the last move is done (refused, to undo it); not before, or the list would jump back meanwhile.
    if (!busy(PLAYLIST_ORDER)) {
      void queryClient.invalidateQueries({ queryKey: ['playlists'] })
    }
  }
}

/** Moves an item to `to`; the page shows it at once, then what the API made of it. */
export async function moveItem(id: string, itemId: string, from: number, to: number): Promise<void> {
  setItemPages(id, (pages) => moveInPages(pages, from, to))
  try {
    await inOrder(id, () => unwrap(api.PATCH('/api/playlist_items/{id}', { params: { path: { id: itemId } }, body: { position: to }, ...MERGE_PATCH })))
  } finally {
    settle(id)
  }
}

/** Takes one appearance of a track out; the page shows it at once, then what the API made of it. */
export async function removeItem(id: string, itemId: string): Promise<void> {
  setItemPages(id, (pages) => pages.map((page) => page.filter((item) => item.id !== itemId)))
  try {
    await inOrder(id, () => unwrapEmpty(api.DELETE('/api/playlist_items/{id}', { params: { path: { id: itemId } } })))
  } finally {
    settle(id)
  }
}
