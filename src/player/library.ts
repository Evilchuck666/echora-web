import { showToast } from '../components/toast'
import { fetchTracksPage, nextPage, pageNumber } from '../library/queries'
import { extendQueue, playQueue } from './engine'
import { usePlayer, type PlayerTrack } from './store'

/** The origin of a queue made of the whole library. */
export const LIBRARY = 'library'

/** Increases on every start, so a previous loading still under way stops. */
let run = 0

/**
 * Plays the whole library: in its order (album artists by name, their albums by year, then disc and track number),
 * or with shuffle on, from a random track of it in any order. The music starts with the first page of tracks loaded
 * (a random one with shuffle) and the other pages join the queue meanwhile, so a large library doesn't keep it
 * waiting. Starting another queue stops the loading.
 */
export async function playLibrary(): Promise<void> {
  const current = ++run
  try {
    const first = await fetchTracksPage(1)
    if (current !== run) {
      return
    }
    if (first.member.length === 0) {
      showToast('The library is empty.')
      return
    }
    const lastPage = pageNumber(first.view?.last) ?? 1
    const startPage = usePlayer.getState().shuffle ? 1 + Math.floor(Math.random() * lastPage) : 1
    const start = startPage === 1 ? first : await fetchTracksPage(startPage)
    if (current !== run) {
      return
    }
    playQueue(start.member, { origin: LIBRARY })

    for (let page = 1; page <= lastPage; page++) {
      if (page === startPage) {
        continue
      }
      const result = page === 1 ? first : await fetchTracksPage(page)
      if (current !== run || !extendQueue(result.member, LIBRARY)) {
        return
      }
    }
  } catch {
    if (current === run) {
      showToast("Couldn't load the whole library.")
    }
  }
}

/**
 * Plays the library from one of its tracks (the Tracks page): the tracks already loaded there come first, from that
 * one (the others in any order with shuffle on), and the pages after them join the queue meanwhile, as playLibrary()
 * does. `nextToLoad` is the first page not loaded yet; undefined when every page is.
 */
export async function playLibraryFrom(loaded: PlayerTrack[], index: number, nextToLoad: number | undefined): Promise<void> {
  const current = ++run
  playQueue(loaded, { startIndex: index, origin: LIBRARY })
  try {
    let page = nextToLoad
    while (page !== undefined) {
      const result = await fetchTracksPage(page)
      if (current !== run || !extendQueue(result.member, LIBRARY)) {
        return
      }
      page = nextPage(result.view)
    }
  } catch {
    if (current === run) {
      showToast("Couldn't load the whole library.")
    }
  }
}
