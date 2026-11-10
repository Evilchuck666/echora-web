import { api } from '../api/client'
import { useSession } from '../auth/tokens'
import { usePlayer, type PlayerState, type PlayerTrack } from './store'

// With the data saver on, the player plays FLAC tracks as Opus, which the API converts on the first request for a
// track (a few seconds, with a spinner meanwhile). This module tells the API which tracks of the queue come next
// (POST /api/transcodes), so it converts them in the background and they start at once. An optimisation: nothing
// waits for it, and a failure changes nothing (the track is then converted when it plays, as before).

const DEVICE_KEY = 'echora.deviceId'

/** At most this many tracks per request: the API's limit. */
export const MAX_TRACKS = 20

/** Changes in a row (a drag, a library added page after page) make one request. */
export const DEBOUNCE_MS = 500

let deviceInMemory: string | undefined

/** A random UUID; crypto.randomUUID() only exists on https and localhost, getRandomValues() everywhere. */
function randomUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * This browser's id for the API, so its list doesn't replace another device's: generated once and kept for good,
 * also after signing out and for every account (it names the browser, not the user). Shared by its tabs.
 */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = randomUuid()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    // No storage (a private window): one id for this visit.
    deviceInMemory ??= randomUuid()
    return deviceInMemory
  }
}

/** Only FLAC tracks have an Opus version. A queue kept from an earlier visit has no URLs, but knows the format. */
function hasOpus(track: PlayerTrack): boolean {
  return Boolean(track.opusStreamUrl) || track.format === 'flac'
}

/** Whether the data saver really plays Opus here: browsers without it play the files as they are. */
function playsOpus(): boolean {
  return document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') !== ''
}

/**
 * The tracks to have converted: the ones after the current one (and then from the top when repeating the queue)
 * that have an Opus version, each once, in order, at most MAX_TRACKS. None without the data saver.
 */
export function tracksToPrepare({ queue, index, repeat, quality }: PlayerState): string[] {
  if (quality !== 'data-saver' || index < 0) {
    return []
  }
  const upcoming = repeat === 'all' ? [...queue.slice(index + 1), ...queue.slice(0, index)] : queue.slice(index + 1)
  const ids: string[] = []
  for (const { track } of upcoming) {
    if (track.id && hasOpus(track) && !ids.includes(track.id)) {
      ids.push(track.id)
      if (ids.length === MAX_TRACKS) {
        break
      }
    }
  }
  return ids
}

/** What was sent last ("[]" once a list was cancelled); undefined before the first request. */
let lastSent: string | undefined
let timer: ReturnType<typeof setTimeout> | undefined

function schedule(): void {
  clearTimeout(timer)
  timer = setTimeout(send, DEBOUNCE_MS)
}

function send(): void {
  timer = undefined
  if (!useSession.getState().signedIn) {
    return
  }
  const tracks = playsOpus() ? tracksToPrepare(usePlayer.getState()) : []
  const key = JSON.stringify(tracks)
  // The same list again, or nothing to cancel.
  if (key === lastSent || (tracks.length === 0 && lastSent === undefined)) {
    return
  }
  lastSent = key
  api
    .POST('/api/transcodes', { body: { device: deviceId(), tracks } })
    .then(({ response }) => {
      if (!response.ok && import.meta.env.DEV) {
        console.debug(`POST /api/transcodes answered ${response.status}: the tracks will be converted when they play.`)
      }
    })
    .catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.debug('POST /api/transcodes failed: the tracks will be converted when they play.', error)
      }
    })
}

usePlayer.subscribe((state, previous) => {
  if (state.queue !== previous.queue || state.index !== previous.index || state.repeat !== previous.repeat || state.quality !== previous.quality) {
    schedule()
  }
})

// The next account starts afresh (the device id stays: it names the browser).
useSession.subscribe((session, previous) => {
  if (previous.signedIn && !session.signedIn) {
    clearTimeout(timer)
    timer = undefined
    lastSent = undefined
  }
})
