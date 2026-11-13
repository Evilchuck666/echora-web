import { api } from '../api/client'
import { queryClient } from '../app/query-client'
import { usePlayer, type PlayerState } from './store'

// The listening history (the API's docs/decisions/0016): the client tells the API when a track counts as listened to,
// with the rule the API recommends (Last.fm's): when it ends, or once half of it, or 4 minutes, has played, whichever
// comes first. Time played, not the position: seeking ahead doesn't count. Once per playthrough: a track played again
// (repeat, Previous back to its start) counts again. Only the tab that plays counts (one tab at a time, engine.ts).

/** Played this long counts, whatever the length. */
const ENOUGH_SECONDS = 240
/** A jump of the position larger than this between two updates is a seek, not playing. */
const SEEK_SECONDS = 2
/** A failed report is sent once more, this much later. */
const RETRY_MS = 10_000

/** The entry being listened to, and how much of it has played. */
let entryKey: string | null = null
let listened = 0
let counted = false
let lastTime = 0

/** Whether this playthrough has played enough to count. */
function enough(state: PlayerState): boolean {
  const duration = state.duration > 0 ? state.duration : (state.queue[state.index]?.track.durationMs ?? 0) / 1000
  return duration > 0 && listened >= Math.min(duration / 2, ENOUGH_SECONDS)
}

function count(state: PlayerState): void {
  const id = state.queue[state.index]?.track.id
  if (counted || !id) {
    return
  }
  counted = true
  void recordPlay(id, new Date())
}

/** Starts a new playthrough of the current entry. */
function restart(state: PlayerState): void {
  entryKey = state.queue[state.index]?.key ?? null
  listened = 0
  counted = false
  lastTime = state.currentTime
}

usePlayer.subscribe((state) => {
  const key = state.queue[state.index]?.key ?? null
  if (key !== entryKey) {
    restart(state)
    return
  }
  const delta = state.currentTime - lastTime
  lastTime = state.currentTime
  if (delta < -SEEK_SECONDS && state.currentTime < 1) {
    // Back to its start (Previous, or the track again with repeat one): a new playthrough, once the last one counted.
    if (counted) {
      restart(state)
    }
    return
  }
  if (state.playing && delta > 0 && delta <= SEEK_SECONDS) {
    listened += delta
    if (enough(state)) {
      count(state)
    }
  }
})

/** The current track ended (called by the engine before the next one starts): it counts, whatever played of it. */
export function trackEnded(): void {
  const state = usePlayer.getState()
  count(state)
  // Repeat one plays it again from the start: another playthrough.
  restart({ ...state, currentTime: 0 })
}

/**
 * Tells the API the user listened to a track (`POST /api/tracks/{id}/plays`), when it was. Fire and forget: sent once
 * more if it fails (the API counts one play of a track within 30 seconds once, so a retry after a lost response
 * doesn't count twice). The history lists are then out of date.
 */
export async function recordPlay(trackId: string, playedAt: Date, retry = true): Promise<void> {
  try {
    const { response } = await api.POST('/api/tracks/{id}/plays', {
      params: { path: { id: trackId } },
      body: { playedAt: playedAt.toISOString() },
    })
    if (response.ok) {
      void queryClient.invalidateQueries({ queryKey: ['history'] })
      return
    }
    if (response.status < 500) {
      // Refused (the track is gone, signed out): trying again won't help.
      return
    }
  } catch {
    // Network error: try again below.
  }
  if (retry) {
    setTimeout(() => void recordPlay(trackId, playedAt, false), RETRY_MS)
  }
}
