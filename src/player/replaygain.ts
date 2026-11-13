import type { Leveling, PlayerTrack } from './store'

// ReplayGain (the API's docs/decisions/0017): tracks whose files have the tags carry `replayGain`, how many decibels
// to apply so every track (or every album, keeping its own dynamics) plays as loud. The player multiplies the volume
// by 10^(gain/20), never by more than 1/peak, or the sound would clip.
//
// Here only through the audio element's volume, which can't go above 1: gains above 0 dB (quiet tracks, rare today)
// play as they are. Raising them would need the Web Audio API, and CORS on the streams in development.

/** What the API sends: the values the file has, in dB and as the loudest sample (1.0 = full scale). */
export interface ReplayGain {
  trackGain?: number
  trackPeak?: number
  albumGain?: number
  albumPeak?: number
}

/**
 * The factor to multiply the volume by, from 0 to 1.
 * - `off`, or a track without tags: 1.
 * - `album` gain when the whole album plays in order (`wholeAlbum`) in `auto`, else the `track` gain; the other one
 *   when the file has only that one.
 */
export function gainFactor(track: Pick<PlayerTrack, 'replayGain'> | undefined, leveling: Leveling, wholeAlbum: boolean): number {
  const tags = track?.replayGain
  if (leveling === 'off' || !tags) {
    return 1
  }
  const preferAlbum = leveling === 'auto' && wholeAlbum
  const album = tags.albumGain !== undefined ? { gain: tags.albumGain, peak: tags.albumPeak } : undefined
  const single = tags.trackGain !== undefined ? { gain: tags.trackGain, peak: tags.trackPeak } : undefined
  const chosen = preferAlbum ? (album ?? single) : (single ?? album)
  if (!chosen || !Number.isFinite(chosen.gain)) {
    return 1
  }
  const factor = 10 ** (chosen.gain / 20)
  const limit = chosen.peak && chosen.peak > 0 ? 1 / chosen.peak : Infinity
  return Math.min(1, factor, limit)
}
