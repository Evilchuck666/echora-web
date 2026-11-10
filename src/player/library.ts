import { showToast } from '../components/toast'
import { fetchTracksPage, pageNumber } from '../library/queries'
import { extendQueue, playQueue } from './engine'
import { usePlayer } from './store'

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
