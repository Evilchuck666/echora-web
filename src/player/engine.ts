import { api } from '../api/client'
import { useSession } from '../auth/tokens'
import { usePlayer, type PlayerTrack } from './store'

// The one audio element of the app. It lives outside React, so the music goes on while pages change; its events
// write the store, and the controls below are the only way to drive it.

const audio = new Audio()
audio.preload = 'auto'

const setState = usePlayer.setState
const getState = usePlayer.getState

/** Previous goes back to the start of the track after this many seconds of it, to the previous track before. */
const RESTART_AFTER_SECONDS = 3

/** A stream URL this close to its expiry is renewed before playing. */
const RENEW_BEFORE_SECONDS = 60

/** Increases on every load and stop, so an older load that is still waiting for the API gives up. */
let loadId = 0
/** Whether the current load already retried with a fresh stream URL after an error. */
let retried = false

// --- Controls ------------------------------------------------------------------------------------------------------

/** Replaces the queue with `tracks` and plays from `startIndex`. */
export function playQueue(tracks: PlayerTrack[], startIndex = 0): void {
  if (tracks.length === 0) {
    return
  }
  setState({ queue: tracks })
  void load(Math.min(Math.max(startIndex, 0), tracks.length - 1))
}

export function togglePlay(): void {
  const { index } = getState()
  if (index < 0) {
    return
  }
  if (!audio.paused) {
    audio.pause()
  } else if (audio.getAttribute('src')) {
    void play()
  } else {
    void load(index, getState().currentTime)
  }
}

export function next(): void {
  const { index, queue } = getState()
  if (index + 1 < queue.length) {
    void load(index + 1)
  }
}

export function previous(): void {
  const { index } = getState()
  if (index < 0) {
    return
  }
  if (audio.currentTime > RESTART_AFTER_SECONDS || index === 0) {
    seek(0)
  } else {
    void load(index - 1)
  }
}

/** Jumps to `seconds` in the current track. The API serves byte ranges, so only that part is downloaded. */
export function seek(seconds: number): void {
  if (getState().index < 0) {
    return
  }
  const target = Math.min(Math.max(seconds, 0), getState().duration || Infinity)
  audio.currentTime = target
  setState({ currentTime: target })
  updatePositionState()
}

export function seekBy(seconds: number): void {
  seek(audio.currentTime + seconds)
}

export function setVolume(volume: number): void {
  const clamped = Math.min(Math.max(volume, 0), 1)
  setState({ volume: clamped, muted: clamped === 0 })
}

export function toggleMute(): void {
  const { muted, volume } = getState()
  // Unmuting at volume 0 would stay silent: bring the volume back up.
  setState(muted && volume === 0 ? { muted: false, volume: 0.5 } : { muted: !muted })
}

/** Stops and forgets the queue (e.g. on sign-out). */
export function stop(): void {
  loadId++
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  setState({ queue: [], index: -1, playing: false, buffering: false, currentTime: 0, duration: 0, error: null })
  updateMediaSession()
}

// --- Loading -------------------------------------------------------------------------------------------------------

async function load(index: number, startAt = 0): Promise<void> {
  const track = getState().queue[index]
  if (!track) {
    return
  }
  const id = ++loadId
  retried = false
  setState({ index, currentTime: startAt, duration: (track.durationMs ?? 0) / 1000, buffering: true, error: null })
  updateMediaSession()

  let url = track.streamUrl
  if (!url || expiresSoon(url)) {
    url = await freshStreamUrl(index)
    if (id !== loadId) {
      return
    }
  }
  if (!url) {
    fail()
    return
  }

  audio.src = url
  if (startAt > 0) {
    audio.currentTime = startAt
  }
  await play()
}

async function play(): Promise<void> {
  try {
    await audio.play()
  } catch (error) {
    // AbortError: another track was loaded meanwhile. NotAllowedError: the browser wants a click first.
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      setState({ playing: false, buffering: false })
    }
  }
}

/** The audio failed, most likely because its signed URL expired (401): fetch the track for a fresh one, once. */
async function recover(): Promise<void> {
  const { index, currentTime } = getState()
  if (index < 0 || !audio.getAttribute('src')) {
    return
  }
  if (retried) {
    fail()
    return
  }
  retried = true
  const id = loadId
  const url = await freshStreamUrl(index)
  if (id !== loadId) {
    return
  }
  if (!url) {
    fail()
    return
  }
  audio.src = url
  audio.currentTime = currentTime
  await play()
}

function fail(): void {
  audio.pause()
  setState({ playing: false, buffering: false, error: "Couldn't play this track." })
}

/** Fetches the track again for a new signed stream URL, and keeps it in the queue for the next time. */
async function freshStreamUrl(index: number): Promise<string | undefined> {
  const track = getState().queue[index]
  if (!track?.id) {
    return undefined
  }
  try {
    const { data } = await api.GET('/api/tracks/{id}', { params: { path: { id: track.id } } })
    const url = data?.streamUrl
    if (url) {
      setState((state) => ({ queue: state.queue.map((queued, i) => (i === index ? { ...queued, streamUrl: url } : queued)) }))
    }
    return url
  } catch {
    return undefined
  }
}

/** Reads the expiry the API put in the signed URL (`_expiration`, a Unix timestamp). The URL is never built here. */
function expiresSoon(url: string): boolean {
  const expiration = Number(new URL(url).searchParams.get('_expiration'))
  return Number.isFinite(expiration) && expiration > 0 && expiration < Date.now() / 1000 + RENEW_BEFORE_SECONDS
}

// --- Audio element → store -----------------------------------------------------------------------------------------

audio.addEventListener('timeupdate', () => setState({ currentTime: audio.currentTime }))
audio.addEventListener('durationchange', () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    setState({ duration: audio.duration })
    updatePositionState()
  }
})
audio.addEventListener('play', () => setState({ playing: true }))
audio.addEventListener('pause', () => setState({ playing: false }))
audio.addEventListener('waiting', () => setState({ buffering: true }))
audio.addEventListener('playing', () => setState({ buffering: false, error: null }))
audio.addEventListener('canplay', () => setState({ buffering: false }))
audio.addEventListener('seeked', updatePositionState)
audio.addEventListener('error', () => void recover())
audio.addEventListener('ended', () => {
  const { index, queue } = getState()
  if (index + 1 < queue.length) {
    void load(index + 1)
  } else {
    // End of the queue: stay on the last track, back at its start.
    audio.currentTime = 0
    setState({ playing: false, currentTime: 0 })
  }
})

// Store → audio element: the volume, remembered between visits.
function applyVolume(): void {
  const { volume, muted } = getState()
  audio.volume = volume
  audio.muted = muted
}
applyVolume()
usePlayer.subscribe((state, previousState) => {
  if (state.volume !== previousState.volume || state.muted !== previousState.muted) {
    applyVolume()
  }
  if (state.playing !== previousState.playing && 'mediaSession' in navigator) {
    navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused'
  }
})

// Signing out (in this tab or another) stops the music: the next account starts with an empty player.
useSession.subscribe((session, previousSession) => {
  if (previousSession.signedIn && !session.signedIn) {
    stop()
  }
})

// --- Media Session: the system's media controls, lock screen and media keys ----------------------------------------

function updateMediaSession(): void {
  if (!('mediaSession' in navigator)) {
    return
  }
  const track = getState().queue[getState().index]
  navigator.mediaSession.metadata = track
    ? new MediaMetadata({
        title: track.title ?? '',
        artist: track.artist?.name ?? '',
        album: track.album?.title ?? '',
        artwork: track.album?.coverUrl ? [{ src: track.album.coverUrl }] : [],
      })
    : null
  if (!track) {
    navigator.mediaSession.playbackState = 'none'
  }
}

function updatePositionState(): void {
  const { duration, index } = getState()
  if (!('mediaSession' in navigator) || index < 0 || !(duration > 0)) {
    return
  }
  try {
    navigator.mediaSession.setPositionState({ duration, position: Math.min(audio.currentTime, duration), playbackRate: audio.playbackRate })
  } catch {
    // Not supported, or a position briefly beyond the duration: the next update will do.
  }
}

if ('mediaSession' in navigator) {
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => togglePlay()],
    ['pause', () => audio.pause()],
    ['previoustrack', () => previous()],
    ['nexttrack', () => next()],
    ['seekbackward', (details) => seekBy(-(details.seekOffset ?? 10))],
    ['seekforward', (details) => seekBy(details.seekOffset ?? 10)],
    ['seekto', (details) => details.seekTime !== undefined && seek(details.seekTime)],
  ]
  for (const [action, handler] of handlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch {
      // This browser doesn't know the action.
    }
  }
}
