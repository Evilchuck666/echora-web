import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ReplayGain } from './replaygain'

/** What the player needs of a track: tracks from an album's list and from the search both fit. */
export interface PlayerTrack {
  id?: string
  title?: string
  durationMs?: number | null
  /** Signed, valid for a few hours; the engine fetches the track again for a fresh one when it has expired. */
  streamUrl?: string
  /** The audio converted to Opus, about a quarter of the size (data saver); FLAC tracks only, null for MP3. */
  opusStreamUrl?: string | null
  /** "flac" or "mp3": which tracks have an Opus version, also once the stream URLs are gone (saved-queue.ts). */
  format?: string
  /** Whether GET /api/tracks/{id} has lyrics for it (the lyrics panel). */
  hasLyrics?: boolean
  /** The file's ReplayGain tags, when it has any (volume leveling, see replaygain.ts). */
  replayGain?: ReplayGain
  /** Whether it was one of the user's favourites when it was queued (the heart in the bar; changes win, see favourites.ts). */
  favourite?: boolean
  artist?: { id?: string; name?: string }
  album?: { id?: string; title?: string; coverUrl?: string | null }
}

/** A track in the queue. The key tells apart the same track queued twice. */
export interface QueueEntry {
  key: string
  track: PlayerTrack
}

/**
 * Original: the files as they are (FLAC, MP3). Data saver: FLAC tracks converted to Opus by the API, about a quarter
 * of the size; MP3 tracks are already small and play as they are.
 */
export type Quality = 'original' | 'data-saver'

/**
 * Volume leveling with ReplayGain tags. Off: tracks play as they are. Track: each at the same loudness. Auto: a whole
 * album played in order keeps its own dynamics (album gain), anything else is levelled track by track.
 */
export type Leveling = 'off' | 'track' | 'auto'

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
  quality: Quality
  leveling: Leveling
  error: string | null
}

/** The first time, data saver on phones and tablets (a touch screen), where the network is often mobile. */
function defaultQuality(): Quality {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'data-saver' : 'original'
}

/**
 * The player's state. Only the engine (engine.ts) writes it, mirroring the audio element; components read it and
 * call the engine's controls. The volume, shuffle, repeat, quality and leveling are remembered between visits here; the queue
 * and the position are too, by the engine (saved-queue.ts).
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
      quality: defaultQuality(),
      leveling: 'auto',
      error: null,
    }),
    {
      name: 'echora.player',
      partialize: ({ volume, muted, shuffle, repeat, quality, leveling }) => ({ volume, muted, shuffle, repeat, quality, leveling }),
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
