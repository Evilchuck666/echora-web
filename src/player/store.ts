import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** What the player needs of a track: tracks from an album's list and from the search both fit. */
export interface PlayerTrack {
  id?: string
  title?: string
  durationMs?: number | null
  /** Signed, valid for a few hours; the engine fetches the track again for a fresh one when it has expired. */
  streamUrl?: string
  artist?: { id?: string; name?: string }
  album?: { id?: string; title?: string; coverUrl?: string | null }
}

export interface PlayerState {
  queue: PlayerTrack[]
  /** Position of the current track in the queue; -1 when nothing is loaded. */
  index: number
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
  error: string | null
}

/**
 * The player's state. Only the engine (engine.ts) writes it, mirroring the audio element; components read it and
 * call the engine's controls. The volume is remembered between visits, the queue isn't.
 */
export const usePlayer = create<PlayerState>()(
  persist(
    (): PlayerState => ({
      queue: [],
      index: -1,
      playing: false,
      buffering: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      error: null,
    }),
    { name: 'echora.player', partialize: ({ volume, muted }) => ({ volume, muted }) },
  ),
)

/** The track being played (or paused), if any. */
export const selectCurrentTrack = (state: PlayerState): PlayerTrack | undefined => state.queue[state.index]
