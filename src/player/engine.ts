import { api } from '../api/client'
import { useSession } from '../auth/tokens'
import { clearSavedQueue, readSavedQueue, writeSavedQueue } from './saved-queue'
// Asks the API to convert the next tracks to Opus ahead of time; it watches the store on its own.
import './transcodes'
import { usePlayer, type PlayerState, type PlayerTrack, type Quality, type QueueEntry, type RepeatMode } from './store'

// The audio of the app lives outside React, so the music goes on while pages change. Two audio elements: `audio`
// plays, and `spare` loads the next track during the end of the current one, then they swap, so the next track
// starts without waiting for the network (FLAC files are large). Only the playing element's events write the store,
// and the controls below are the only way to drive them.

const setState = usePlayer.setState
const getState = usePlayer.getState

let audio = createAudio('current')
let spare = createAudio('next')

/** Whether this browser plays Opus (in Ogg), what the API converts FLAC to for the data saver. */
export function canPlayOpus(): boolean {
  return audio.canPlayType('audio/ogg; codecs="opus"') !== ''
}

/** The next track starts loading this many seconds before the current one ends. */
const PRELOAD_BEFORE_END_SECONDS = 30

/** The queue entry the spare element is loading (`url` once it has one), if any. */
let preloaded: { key: string; url?: string } | null = null
/** The queue entry whose audio `audio` holds: until a new track's URL is set, it still holds the previous one. */
let loadedKey: string | null = null

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

/**
 * Adds `tracks` to a queue that is still being loaded (the whole library, page after page): at the end, or with
 * shuffle on, each anywhere after the current track. False once the queue is another one (`origin` changed): the
 * loading should stop.
 */
export function extendQueue(tracks: PlayerTrack[], origin: string): boolean {
  if (getState().origin !== origin) {
    return false
  }
  const entries = toEntries(tracks)
  setState((state) => {
    const queue = [...state.queue]
    if (state.shuffle) {
      for (const entry of entries) {
        queue.splice(state.index + 1 + randomIndex(queue.length - state.index), 0, entry)
      }
    } else {
      queue.push(...entries)
    }
    return { queue, unshuffled: [...state.unshuffled, ...entries] }
  })
  return true
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

/**
 * Original files or data saver (FLAC as Opus). The track that is playing switches at once, where it was; the next
 * one is loaded again in the new quality.
 */
export function setQuality(quality: Quality): void {
  if (quality === getState().quality) {
    return
  }
  setState({ quality })
  const { queue, index } = getState()
  const entry = queue[index]
  const url = entry && urlFor(entry.track)
  if (!url || loadedKey !== entry.key || !audio.getAttribute('src') || url === audio.src) {
    return
  }
  const wasPlaying = !audio.paused
  const position = audio.currentTime
  retried = false
  audio.src = url
  audio.currentTime = position
  if (wasPlaying) {
    setState({ buffering: true })
    void play()
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
  dropPreload()
  empty(audio)
  loadedKey = null
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
  const entry = getState().queue[index]
  if (!entry) {
    return
  }
  const track = entry.track
  const id = ++loadId
  retried = false
  if (startAt === 0 && preloaded?.key === entry.key && preloaded.url && !spare.error) {
    await playPreloaded(index)
    return
  }
  if (preloaded?.key === entry.key) {
    dropPreload()
  }
  setState({ index, currentTime: startAt, duration: (track.durationMs ?? 0) / 1000, buffering: true, error: null })
  updateMediaSession()

  let url = urlFor(track)
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
  loadedKey = entry.key
  if (startAt > 0) {
    audio.currentTime = startAt
  }
  await play()
}

/** Shown in the player when the browser refuses to start the audio without a click (e.g. the next track). */
export const AUTOPLAY_BLOCKED = 'Autoplay blocked: press Play'

async function play(): Promise<void> {
  try {
    await audio.play()
  } catch (error) {
    // AbortError: another track was loaded meanwhile. NotAllowedError: the browser wants a click first, as Firefox
    // does for every play() when its autoplay setting blocks audio: say so, or the player just seems to stop.
    if (isNotAllowed(error)) {
      setState({ playing: false, buffering: false, error: AUTOPLAY_BLOCKED })
    }
  }
}

function isNotAllowed(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError'
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

/**
 * Plays the track the spare element has loaded: the elements swap, and once the new one plays, the old one is emptied
 * to become the spare.
 */
async function playPreloaded(index: number): Promise<void> {
  const id = loadId
  const key = preloaded?.key ?? null
  const previous = audio
  const previousSrc = previous.getAttribute('src')
  swapElements()
  // Nothing more is preloaded until the swap is over: the old element is the fallback until the new one plays.
  loadedKey = null
  preloaded = null
  previous.pause()

  const track = getState().queue[index].track
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (track.durationMs ?? 0) / 1000
  setState({ index, currentTime: 0, duration, buffering: audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA, error: null })
  updateMediaSession()
  updatePositionState()
  try {
    await audio.play()
  } catch (error) {
    if (isNotAllowed(error) && id === loadId) {
      // Some browsers (Safari) only let an element play once a click has started it, and the spare never had one:
      // the element that was playing, left as it was until now, loads the track instead, as without preloading.
      const url = audio.src
      empty(audio)
      swapElements()
      setState({ buffering: true })
      audio.src = url
      loadedKey = key
      await play()
    }
    return
  }
  if (id !== loadId) {
    return
  }
  // Let go of the track that ended (unless the element was used for something else meanwhile).
  if (previous === spare && previous.getAttribute('src') === previousSrc) {
    empty(previous)
  }
  loadedKey = key
  preloadNext()
}

function swapElements(): void {
  ;[audio, spare] = [spare, audio]
  audio.dataset.player = 'current'
  spare.dataset.player = 'next'
}

/** The entry that plays after the current one, if any: the next in the queue, or the first when repeating it. */
function nextEntry(): QueueEntry | undefined {
  const { index, queue, repeat } = getState()
  if (index < 0 || repeat === 'one') {
    return undefined
  }
  if (index + 1 < queue.length) {
    return queue[index + 1]
  }
  return repeat === 'all' && queue.length > 1 ? queue[0] : undefined
}

/**
 * Near the end of the current track, starts loading the next one in the spare element. Called as the track plays
 * and whenever the queue changes: what was loaded for a track that is no longer next is dropped.
 */
function preloadNext(): void {
  const entry = nextEntry()
  if (preloaded && preloaded.key !== entry?.key) {
    dropPreload()
  }
  const { queue, index } = getState()
  const remaining = audio.duration - audio.currentTime
  if (!entry || preloaded || loadedKey !== queue[index]?.key || !(remaining <= PRELOAD_BEFORE_END_SECONDS)) {
    return
  }
  const key = entry.key
  preloaded = { key }
  const url = urlFor(entry.track)
  if (url && !expiresSoon(url)) {
    startPreload(key, url)
    return
  }
  void freshStreamUrl(getState().queue.indexOf(entry)).then((fresh) => {
    if (fresh && preloaded?.key === key && !preloaded.url) {
      startPreload(key, fresh)
    }
  })
}

function startPreload(key: string, url: string): void {
  preloaded = { key, url }
  spare.src = url
}

function dropPreload(): void {
  preloaded = null
  empty(spare)
}

/** Stops an element and lets go of what it downloaded. */
function empty(element: HTMLAudioElement): void {
  element.pause()
  if (element.getAttribute('src')) {
    element.removeAttribute('src')
    element.load()
  }
}

function fail(): void {
  audio.pause()
  setState({ playing: false, buffering: false, error: "Couldn't play this track." })
}

/** The URL to play a track from: its Opus version with the data saver on (FLAC tracks only), else the file as is. */
function urlFor(track: PlayerTrack): string | undefined {
  return getState().quality === 'data-saver' && canPlayOpus() && track.opusStreamUrl ? track.opusStreamUrl : track.streamUrl
}

/** Fetches the track again for new signed URLs, keeps them in the queue for the next time, and returns the one to play. */
async function freshStreamUrl(index: number): Promise<string | undefined> {
  const entry = getState().queue[index]
  if (!entry?.track.id) {
    return undefined
  }
  try {
    const { data } = await api.GET('/api/tracks/{id}', { params: { path: { id: entry.track.id } } })
    if (!data?.streamUrl) {
      return undefined
    }
    // The album's cover URL is renewed too: a queue kept from an earlier visit may hold one a day old.
    const album = entry.track.album && data.album ? { ...entry.track.album, coverUrl: data.album.coverUrl ?? null } : entry.track.album
    const track = { ...entry.track, streamUrl: data.streamUrl, opusStreamUrl: data.opusStreamUrl ?? null, album }
    const renew = (queued: QueueEntry) => (queued.key === entry.key ? { ...queued, track } : queued)
    setState((state) => ({ queue: state.queue.map(renew), unshuffled: state.unshuffled.map(renew) }))
    return urlFor(track)
  } catch {
    return undefined
  }
}

/** Reads the expiry the API put in the signed URL (`_expiration`, a Unix timestamp). The URL is never built here. */
function expiresSoon(url: string): boolean {
  const expiration = Number(new URL(url).searchParams.get('_expiration'))
  return Number.isFinite(expiration) && expiration > 0 && expiration < Date.now() / 1000 + RENEW_BEFORE_SECONDS
}

// --- Audio elements → store --------------------------------------------------------------------------------------

/** An audio element; its events only count while it is the one playing (`audio`). */
function createAudio(role: 'current' | 'next'): HTMLAudioElement {
  const element = new Audio()
  element.preload = 'auto'
  // Which element is which: handy in the developer tools, and for the tests.
  element.dataset.player = role
  const on = (type: string, listener: () => void) =>
    element.addEventListener(type, () => {
      if (element === audio) {
        listener()
      }
    })

  on('timeupdate', () => {
    setState({ currentTime: audio.currentTime })
    preloadNext()
  })
  on('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setState({ duration: audio.duration })
      updatePositionState()
    }
  })
  on('play', () => {
    setState({ playing: true })
    announcePlaying()
  })
  on('pause', () => {
    setState({ playing: false })
    saveNow()
  })
  on('waiting', () => setState({ buffering: true }))
  on('playing', () => setState({ buffering: false, error: null }))
  on('canplay', () => setState({ buffering: false }))
  on('seeked', updatePositionState)
  on('error', () => void recover())
  on('ended', onEnded)
  // The next track failed to load (e.g. its URL expired meanwhile): it will load the usual way when its turn comes.
  element.addEventListener('error', () => {
    if (element === spare && preloaded?.url) {
      dropPreload()
    }
  })
  return element
}

function onEnded(): void {
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
}

// Store → audio element: the volume, remembered between visits.
function applyVolume(): void {
  const { volume, muted } = getState()
  for (const element of [audio, spare]) {
    element.volume = volume
    element.muted = muted
  }
}
applyVolume()
usePlayer.subscribe((state, previousState) => {
  if (
    state.queue !== previousState.queue ||
    state.unshuffled !== previousState.unshuffled ||
    state.index !== previousState.index ||
    state.origin !== previousState.origin ||
    state.currentTime !== previousState.currentTime
  ) {
    scheduleSave()
  }
  if (state.volume !== previousState.volume || state.muted !== previousState.muted) {
    applyVolume()
  }
  if (state.quality !== previousState.quality) {
    // What was loaded for the next track is in the other quality.
    dropPreload()
  }
  if (
    state.queue !== previousState.queue ||
    state.index !== previousState.index ||
    state.repeat !== previousState.repeat ||
    state.quality !== previousState.quality
  ) {
    preloadNext()
  }
  if (state.playing !== previousState.playing && 'mediaSession' in navigator) {
    navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused'
  }
})

// Signing out (in this tab or another) stops the music: the next account starts with an empty player.
useSession.subscribe((session, previousSession) => {
  if (previousSession.signedIn && !session.signedIn) {
    stop()
    clearSavedQueue()
  }
})

// --- Kept between visits --------------------------------------------------------------------------------------------

// The queue, the current track and the position are saved (saved-queue.ts) a few seconds after they change, at once
// on pause and when the page goes away, and put back, paused, when the app opens again. A tab only saves what it
// changed itself: one left idle never overwrites what another tab saved meanwhile.

/** Saves come at most this often while the music plays (the position changes several times a second). */
const SAVE_EVERY_MS = 5000

/** Whether this tab changed the queue or the position since it last saved them. */
let dirty = false
let saveTimer: ReturnType<typeof setTimeout> | undefined

function scheduleSave(): void {
  dirty = true
  saveTimer ??= setTimeout(saveNow, SAVE_EVERY_MS)
}

function saveNow(): void {
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (!dirty) {
    return
  }
  dirty = false
  const { queue, unshuffled, index, origin, currentTime } = getState()
  if (index < 0) {
    clearSavedQueue()
  } else {
    writeSavedQueue({ queue, unshuffled, index, origin, currentTime })
  }
}

window.addEventListener('pagehide', saveNow)
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveNow())

/**
 * Puts back the queue an earlier visit saved, paused where it was: Play goes on from there (the stream URLs are
 * fetched again then). Runs once when the engine starts; nothing happens if a queue is loaded already.
 */
export function restoreSavedQueue(): void {
  const saved = readSavedQueue()
  if (!saved || getState().index >= 0) {
    return
  }
  const entries = toEntries(saved.tracks)
  const inOrder = saved.unshuffledOrder.map((i) => entries[i])
  // Any entry the saved order lacks (it shouldn't happen) keeps a place at the end.
  const unshuffled = [...inOrder, ...entries.filter((entry) => !inOrder.includes(entry))]
  const track = entries[saved.index].track
  setState({
    queue: entries,
    unshuffled,
    index: saved.index,
    origin: saved.origin,
    currentTime: saved.currentTime,
    duration: (track.durationMs ?? 0) / 1000,
    playing: false,
    buffering: false,
    error: null,
  })
  updateMediaSession()
  // What was just read is what is saved: nothing to write until this tab changes something.
  dirty = false
  clearTimeout(saveTimer)
  saveTimer = undefined
}

// --- One tab at a time ----------------------------------------------------------------------------------------------

// The app may be open in several tabs, each with its own player: when one starts playing, the others pause, so two
// tracks never play over each other. Each keeps its queue and can be resumed, which pauses the others in turn.
const tabs = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('echora.player')

function announcePlaying(): void {
  tabs?.postMessage({ type: 'playing' })
}

tabs?.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
  if (event.data?.type === 'playing' && !audio.paused) {
    audio.pause()
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

restoreSavedQueue()

// --- Development: hot module replacement ----------------------------------------------------------------------------

// The dev server swaps an edited module without reloading the page. This one has a life of its own (two audio
// elements, their listeners, a channel between tabs): swapped, the old engine would go on playing beside the new one,
// and the controls would drive the new one. So a change to it, or to a module it uses (the store, the saved queue),
// reloads the whole page instead; the queue comes back paused where it was. (`hot.decline()` would do nothing: Vite
// keeps it as an empty method.) Production builds leave this out.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload())
}
