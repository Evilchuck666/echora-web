import { api } from '../api/client'
import { useSession } from '../auth/tokens'
import { usePlayer, type PlayerState, type PlayerTrack, type QueueEntry, type RepeatMode } from './store'

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
/** Numbers the queue entries, so the same track queued twice can be told apart. */
let entryCount = 0

// --- Controls ------------------------------------------------------------------------------------------------------

interface PlayQueueOptions {
  /** The track to start from. Without it, the first one, or a random one when shuffle is on. */
  startIndex?: number
  /** What the queue is started from, e.g. "artist:{id}", for a page to tell whether it is playing. */
  origin?: string
}

/** Replaces the queue with `tracks` and plays them. With shuffle on, the tracks after the first come in any order. */
export function playQueue(tracks: PlayerTrack[], { startIndex, origin }: PlayQueueOptions = {}): void {
  if (tracks.length === 0) {
    return
  }
  const entries = toEntries(tracks)
  const shuffle = getState().shuffle
  const start = Math.min(Math.max(startIndex ?? (shuffle ? randomIndex(entries.length) : 0), 0), entries.length - 1)
  const queue = shuffle ? [entries[start], ...shuffled(entries.filter((_, i) => i !== start))] : entries
  setState({ queue, unshuffled: entries, origin: origin ?? null })
  void load(shuffle ? 0 : start)
}

/** Queues `tracks` right after the current one, in their order. With nothing queued, they are loaded, paused. */
export function playNext(tracks: PlayerTrack[]): void {
  if (tracks.length === 0) {
    return
  }
  const { queue, unshuffled, index } = getState()
  if (index < 0) {
    cue(tracks)
    return
  }
  const entries = toEntries(tracks)
  const current = queue[index]
  const at = unshuffled.findIndex((entry) => entry.key === current.key) + 1
  setState({
    queue: [...queue.slice(0, index + 1), ...entries, ...queue.slice(index + 1)],
    unshuffled: [...unshuffled.slice(0, at), ...entries, ...unshuffled.slice(at)],
  })
}

/** Queues `tracks` at the end. With nothing queued, they are loaded, paused. */
export function addToQueue(tracks: PlayerTrack[]): void {
  if (tracks.length === 0) {
    return
  }
  if (getState().index < 0) {
    cue(tracks)
    return
  }
  const entries = toEntries(tracks)
  setState((state) => ({ queue: [...state.queue, ...entries], unshuffled: [...state.unshuffled, ...entries] }))
}

/** Plays the queued entry `key`. The tracks before it stay in the queue, as played. */
export function jumpTo(key: string): void {
  const index = getState().queue.findIndex((entry) => entry.key === key)
  if (index >= 0) {
    void load(index)
  }
}

/** Takes the entry `key` out of the queue. The current track stays: skip it instead. */
export function removeFromQueue(key: string): void {
  const { queue, index } = getState()
  if (queue[index]?.key === key) {
    return
  }
  setState((state) => withQueue(state.queue.filter((entry) => entry.key !== key), {
    unshuffled: state.unshuffled.filter((entry) => entry.key !== key),
  }))
}

/**
 * Moves the entry `key` to position `to` in the queue. With shuffle off this is the queue's order from now on; with
 * shuffle on, turning it off brings back the order the tracks were queued in.
 */
export function moveInQueue(key: string, to: number): void {
  const { queue, shuffle } = getState()
  const from = queue.findIndex((entry) => entry.key === key)
  if (from < 0) {
    return
  }
  const moved = [...queue]
  const [entry] = moved.splice(from, 1)
  moved.splice(Math.min(Math.max(to, 0), moved.length), 0, entry)
  setState(withQueue(moved, shuffle ? {} : { unshuffled: moved }))
}

/** Shuffles the tracks after the current one, or puts the queue back in the order its tracks were queued in. */
export function toggleShuffle(): void {
  const { shuffle, queue, unshuffled, index } = getState()
  if (shuffle) {
    setState(withQueue(unshuffled, { shuffle: false }))
  } else {
    setState({ shuffle: true, unshuffled: queue, queue: [...queue.slice(0, index + 1), ...shuffled(queue.slice(index + 1))] })
  }
}

const NEXT_REPEAT_MODE: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' }

/** Off, then the whole queue, then the current track, then off again. */
export function cycleRepeat(): void {
  setState((state) => ({ repeat: NEXT_REPEAT_MODE[state.repeat] }))
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

/** The next track; after the last one, the first again when repeating the queue. */
export function next(): void {
  const { index, queue, repeat } = getState()
  if (index + 1 < queue.length) {
    void load(index + 1)
  } else if (repeat === 'all' && queue.length > 0) {
    void load(0)
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
  setState({ queue: [], unshuffled: [], index: -1, origin: null, playing: false, buffering: false, currentTime: 0, duration: 0, error: null })
  updateMediaSession()
}

// --- Queue helpers -------------------------------------------------------------------------------------------------

function toEntries(tracks: PlayerTrack[]): QueueEntry[] {
  return tracks.map((track) => ({ key: `entry-${++entryCount}`, track }))
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length)
}

/** A shuffled copy (Fisher-Yates). */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** A new queue, with the index following the current entry to wherever it is now. */
function withQueue(queue: QueueEntry[], changes: Partial<PlayerState> = {}): Partial<PlayerState> {
  const { queue: previous, index } = getState()
  const currentKey = previous[index]?.key
  return { ...changes, queue, index: queue.findIndex((entry) => entry.key === currentKey) }
}

/** Loads `tracks` as the queue without playing, for Play next and Add to queue when nothing is queued. */
function cue(tracks: PlayerTrack[]): void {
  const entries = toEntries(tracks)
  const queue = getState().shuffle ? shuffled(entries) : entries
  setState({ queue, unshuffled: entries, origin: null, index: 0, currentTime: 0, duration: (queue[0].track.durationMs ?? 0) / 1000, error: null })
  updateMediaSession()
}

// --- Loading -------------------------------------------------------------------------------------------------------

async function load(index: number, startAt = 0): Promise<void> {
  const track = getState().queue[index]?.track
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
  const entry = getState().queue[index]
  if (!entry?.track.id) {
    return undefined
  }
  try {
    const { data } = await api.GET('/api/tracks/{id}', { params: { path: { id: entry.track.id } } })
    const url = data?.streamUrl
    if (url) {
      const renew = (queued: QueueEntry) => (queued.key === entry.key ? { ...queued, track: { ...queued.track, streamUrl: url } } : queued)
      setState((state) => ({ queue: state.queue.map(renew), unshuffled: state.unshuffled.map(renew) }))
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
  const { index, queue, repeat } = getState()
  if (repeat === 'one') {
    audio.currentTime = 0
    void play()
  } else if (index + 1 < queue.length) {
    void load(index + 1)
  } else if (repeat === 'all') {
    void load(0)
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
  const track = getState().queue[getState().index]?.track
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
