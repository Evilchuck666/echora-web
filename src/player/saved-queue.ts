import type { PlayerTrack, QueueEntry } from './store'

// The queue kept between visits, in localStorage (this browser only), so that reloading or coming back another day
// goes on where the music was. The engine (engine.ts) decides when to save and restores it when it starts.

const KEY = 'echora.queue'
const VERSION = 1

/** At most this many tracks are kept: a whole library can be queued, and localStorage holds a few megabytes. */
export const MAX_SAVED = 1000
/** Of those, this many before the current track, the rest after it; more before when fewer tracks come after. */
const SAVED_BEFORE = 100

export interface QueueToSave {
  queue: QueueEntry[]
  unshuffled: QueueEntry[]
  index: number
  origin: string | null
  /** Seconds into the current track. */
  currentTime: number
}

export interface SavedQueue {
  /** In the order they play. */
  tracks: PlayerTrack[]
  /** The order they were queued in (positions in `tracks`), for when shuffle is turned off. */
  unshuffledOrder: number[]
  index: number
  origin: string | null
  currentTime: number
}

interface Stored extends SavedQueue {
  version: typeof VERSION
}

/**
 * What is kept of a track. Not its stream URLs: they expire after a few hours, and the engine fetches fresh ones
 * when it plays a track without them. The album's cover URL stays for a day.
 */
function slim(track: PlayerTrack): PlayerTrack {
  return {
    id: track.id,
    title: track.title,
    durationMs: track.durationMs,
    format: track.format,
    hasLyrics: track.hasLyrics,
    replayGain: track.replayGain,
    favourite: track.favourite,
    artist: track.artist && { id: track.artist.id, name: track.artist.name },
    album: track.album && { id: track.album.id, title: track.album.title, coverUrl: track.album.coverUrl },
  }
}

export function writeSavedQueue({ queue, unshuffled, index, origin, currentTime }: QueueToSave): void {
  const start = Math.max(0, Math.min(index - SAVED_BEFORE, queue.length - MAX_SAVED))
  const kept = queue.slice(start, start + MAX_SAVED)
  const position = new Map(kept.map((entry, i) => [entry.key, i]))
  const stored: Stored = {
    version: VERSION,
    tracks: kept.map((entry) => slim(entry.track)),
    unshuffledOrder: unshuffled.map((entry) => position.get(entry.key)).filter((i) => i !== undefined),
    index: index - start,
    origin,
    currentTime,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // Full, or storage refused (a private window): the queue just isn't remembered this time.
  }
}

/** The queue saved by an earlier visit, if there is a usable one. */
export function readSavedQueue(): SavedQueue | undefined {
  let stored: Partial<Stored>
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}
  } catch {
    return undefined
  }
  const { version, tracks, unshuffledOrder, index, origin, currentTime } = stored
  if (version !== VERSION || !Array.isArray(tracks) || tracks.length === 0 || typeof index !== 'number' || !(index >= 0 && index < tracks.length)) {
    return undefined
  }
  return {
    tracks,
    unshuffledOrder: Array.isArray(unshuffledOrder) ? unshuffledOrder.filter((i) => Number.isInteger(i) && i >= 0 && i < tracks.length) : [],
    index,
    origin: typeof origin === 'string' ? origin : null,
    currentTime: typeof currentTime === 'number' && currentTime >= 0 ? currentTime : 0,
  }
}

export function clearSavedQueue(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do.
  }
}
