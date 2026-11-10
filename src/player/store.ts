import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** What the player needs of a track: tracks from an album's list and from the search both fit. */
export interface PlayerTrack {
  id?: string
  title?: string
  durationMs?: number | null
  /** Signed, valid for a few hours; the engine fetches the track again for a fresh one when it has expired. */
  streamUrl?: string
  /** Whether GET /api/tracks/{id} has lyrics for it (the lyrics panel). */
  hasLyrics?: boolean
  artist?: { id?: string; name?: string }
  album?: { id?: string; title?: string; coverUrl?: string | null }
}

/** A track in the queue. The key tells apart the same track queued twice. */
export interface QueueEntry {
  key: string
  track: PlayerTrack
}

/** Off: stop after the last track. All: start the queue again. One: play the current track again. */
export type RepeatMode = 'off' | 'all' | 'one'

export interface PlayerState {
  /** In the order the tracks play (shuffled when shuffle is on). */
  queue: QueueEntry[]
  /** The same entries in the order they were queued, to come back to when shuffle is turned off. */
  unshuffled: QueueEntry[]
  /** Position of the current track in the queue; -1 when nothing is loaded. */
  index: number
  /** What the queue was started from, e.g. "artist:{id}" for an artist's Play all. */
  origin: string | null
  playing: boolean
  /** Waiting for audio data (start, seek, slow network). */
  buffering: boolean
  /** Seconds. */
  currentTime: number
  /** Seconds; the track's tagged length until the audio says otherwise. */
  duration: number
  /** 0 to 1. */
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  error: string | null
}

/**
 * The player's state. Only the engine (engine.ts) writes it, mirroring the audio element; components read it and
 * call the engine's controls. The volume, shuffle and repeat are remembered between visits, the queue isn't.
 */
export const usePlayer = create<PlayerState>()(
  persist(
    (): PlayerState => ({
      queue: [],
      unshuffled: [],
      index: -1,
      origin: null,
      playing: false,
      buffering: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      shuffle: false,
      repeat: 'off',
      error: null,
    }),
    {
      name: 'echora.player',
      partialize: ({ volume, muted, shuffle, repeat }) => ({ volume, muted, shuffle, repeat }),
    },
  ),
)

/** The track being played (or paused), if any. */
export const selectCurrentTrack = (state: PlayerState): PlayerTrack | undefined => state.queue[state.index]?.track

/** The tracks that come after the current one. */
export const selectUpcoming = (state: PlayerState): QueueEntry[] => state.queue.slice(state.index + 1)

/** Whether Next has somewhere to go: a track after this one, or the start of the queue when repeating it. */
export const selectHasNext = (state: PlayerState): boolean =>
  state.index + 1 < state.queue.length || (state.repeat === 'all' && state.queue.length > 0)
