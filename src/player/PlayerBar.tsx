import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { Cover } from '../components/Cover'
import { FavouriteButton } from '../components/FavouriteButton'
import { formatDuration } from '../library/format'
import { AUTOPLAY_BLOCKED, cycleRepeat, next, previous, seek, seekBy, setVolume, toggleMute, togglePlay, toggleShuffle } from './engine'
import {
  LyricsIcon,
  MutedIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  VolumeIcon,
} from './icons'
import { playLibrary } from './library'
import { LYRICS_PANEL_ID, LyricsPanel } from './LyricsPanel'
import { QualityMenu } from './QualityMenu'
import { QUEUE_PANEL_ID, QueuePanel } from './QueuePanel'
import { selectCurrentTrack, selectHasNext, usePlayer, type RepeatMode } from './store'
import { usePanels } from './usePanels'

/** Arrow keys move this many seconds in the track. */
const ARROW_SEEK_SECONDS = 5

/**
 * The player, fixed at the bottom of every signed-in page. With nothing queued, Play (or space) plays the whole
 * library, in order or shuffled. Space plays and pauses, the left and right arrows move in the track, unless the
 * focus is on something that uses those keys itself. The
 * lyrics and queue panels open from it (in a column at the right of the page on large screens, see usePanels) and
 * follow the player from one track to the next.
 */
export function PlayerBar() {
  const track = usePlayer(selectCurrentTrack)
  const playing = usePlayer((state) => state.playing)
  const buffering = usePlayer((state) => state.buffering)
  const error = usePlayer((state) => state.error)
  const hasNext = usePlayer(selectHasNext)
  const panels = usePanels()
  // With nothing loaded, the panels stay closed (the column's choice is kept for when something plays).
  const lyricsOpen = track !== undefined && panels.isOpen('lyrics')
  const queueOpen = track !== undefined && panels.isOpen('queue')
  const { close } = panels
  const closeLyrics = useCallback(() => close('lyrics'), [close])
  const closeQueue = useCallback(() => close('queue'), [close])
  const [startingLibrary, setStartingLibrary] = useState(false)

  const play = useCallback(async () => {
    if (usePlayer.getState().index >= 0) {
      togglePlay()
      return
    }
    setStartingLibrary(true)
    try {
      await playLibrary()
    } finally {
      setStartingLibrary(false)
    }
  }, [])

  usePlayerShortcuts(play, track !== undefined)

  return (
    <>
      {/* Keeps the end of the page clear of the fixed bar. */}
      <div aria-hidden="true" className="h-20 shrink-0" />
      <section
        aria-label="Player"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur"
      >
        <MobileProgress />
        <div className="flex h-20 items-center gap-4 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:w-1/4 md:flex-none">
            <Cover url={track?.album?.coverUrl} alt="" className="w-12 shrink-0 rounded" />
            <div className="min-w-0">
              {!track ? (
                <>
                  <p className="truncate font-medium text-neutral-300">Nothing playing</p>
                  <p className="truncate text-sm text-neutral-500" title="Play to hear the whole library">
                    Play to hear the whole library
                  </p>
                </>
              ) : (
                <Link to={`/albums/${track.album?.id}`} className="block truncate font-medium hover:underline">
                  {track.title}
                </Link>
              )}
              {!track ? null : error ? (
                <p role="alert" title={errorHint(error)} className="truncate text-sm text-red-400">
                  {error}
                  {errorHint(error) && <span className="sr-only">. {errorHint(error)}</span>}
                </p>
              ) : (
                <Link to={`/artists/${track.artist?.id}`} className="block truncate text-sm text-neutral-400 hover:underline">
                  {track.artist?.name}
                </Link>
              )}
            </div>
            {track && (
              <FavouriteButton
                kind="track"
                id={track.id}
                favourite={track.favourite}
                name={track.title ?? 'Unknown track'}
                className="hidden h-8 w-8 shrink-0 sm:flex"
                iconClassName="h-4.5 w-4.5"
              />
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1 md:flex-1">
            {/* A little higher than centred (wide screens, where the slider is below): away from the slider's thumb. */}
            <div className="flex items-center gap-2 sm:-translate-y-1 sm:gap-4">
              <ShuffleButton />
              <button
                type="button"
                onClick={previous}
                disabled={!track}
                aria-label="Previous"
                className="hidden p-1 text-neutral-300 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-300 sm:block"
              >
                <PreviousIcon />
              </button>
              <button
                type="button"
                onClick={() => void play()}
                disabled={startingLibrary}
                aria-label={playing ? 'Pause' : 'Play'}
                title={track ? undefined : 'Play the whole library'}
                className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-neutral-100 text-neutral-950 hover:scale-105"
              >
                {startingLibrary || (buffering && playing) ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-950" />
                ) : playing ? (
                  <PauseIcon className="h-4.5 w-4.5" />
                ) : (
                  <PlayIcon className="ml-0.5 h-4.5 w-4.5" />
                )}
              </button>
              <button
                type="button"
                onClick={next}
                disabled={!hasNext}
                aria-label="Next"
                className="p-1 text-neutral-300 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-300"
              >
                <NextIcon />
              </button>
              <RepeatButton />
            </div>
            <Progress disabled={!track} />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3 md:w-1/4">
            <button
              type="button"
              onClick={() => panels.toggle('lyrics')}
              disabled={!track || (!lyricsOpen && track.hasLyrics === false)}
              aria-label="Lyrics"
              aria-expanded={lyricsOpen}
              aria-controls={lyricsOpen ? LYRICS_PANEL_ID : undefined}
              title={track?.hasLyrics === false ? 'This track has no lyrics' : undefined}
              className="p-1 text-neutral-300 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-300 aria-expanded:text-violet-400"
            >
              <LyricsIcon />
            </button>
            <button
              type="button"
              onClick={() => panels.toggle('queue')}
              disabled={!track}
              aria-label="Queue"
              aria-expanded={queueOpen}
              aria-controls={queueOpen ? QUEUE_PANEL_ID : undefined}
              className="p-1 text-neutral-300 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-300 aria-expanded:text-violet-400"
            >
              <QueueIcon />
            </button>
            <QualityMenu />
            <Volume />
          </div>
        </div>
      </section>
      {!track ? null : panels.docked ? (
        (lyricsOpen || queueOpen) && (
          // Between the header (h-14) and the bar (h-20); AppLayout leaves the page room for it (useDockedColumn).
          <div className="fixed top-14 right-0 bottom-20 z-10 flex w-96 flex-col border-l border-neutral-800 bg-neutral-950">
            {/* The queue on top: it is open from the start, and stays put when the lyrics come and go below it. */}
            {queueOpen && <QueuePanel onClose={closeQueue} docked />}
            {lyricsOpen && <LyricsPanel track={track} onClose={closeLyrics} docked />}
          </div>
        )
      ) : (
        <>
          {lyricsOpen && <LyricsPanel track={track} onClose={closeLyrics} beside={queueOpen} />}
          {queueOpen && <QueuePanel onClose={closeQueue} />}
        </>
      )}
    </>
  )
}

/** Elapsed time, a slider to move in the track, and the length. The slider only seeks once it is let go. */
function Progress({ disabled }: { disabled: boolean }) {
  const currentTime = usePlayer((state) => state.currentTime)
  const duration = usePlayer((state) => state.duration)
  const [dragging, setDragging] = useState<number | null>(null)
  const shown = dragging ?? currentTime
  // How much of the track the slider fills (its own colour up to the thumb: a styled slider loses the browser's).
  const fill = duration > 0 ? Math.min(shown / duration, 1) * 100 : 0

  function commit() {
    if (dragging !== null) {
      seek(dragging)
      setDragging(null)
    }
  }

  return (
    <div className="hidden w-full max-w-xl items-center gap-2 text-xs text-neutral-400 tabular-nums sm:flex">
      <span className="w-10 text-right">{formatDuration(shown * 1000)}</span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(shown, duration || 0)}
        onChange={(event) => setDragging(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        disabled={disabled}
        aria-label="Position in the track"
        aria-valuetext={`${formatDuration(shown * 1000)} of ${formatDuration(duration * 1000)}`}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        className="player-slider flex-1"
      />
      <span className="w-10">{formatDuration(duration * 1000)}</span>
    </div>
  )
}

/** On narrow screens, a thin bar along the top edge instead of the slider. */
function MobileProgress() {
  const fraction = usePlayer((state) => (state.duration > 0 ? Math.min(state.currentTime / state.duration, 1) : 0))

  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-neutral-800 sm:hidden">
      <div className="h-full bg-violet-400" style={{ width: `${fraction * 100}%` }} />
    </div>
  )
}

/** More about an error than the bar has room for, as a tooltip and for screen readers. */
function errorHint(error: string): string | undefined {
  return error === AUTOPLAY_BLOCKED
    ? "The browser didn't let the next track start by itself. Allow autoplay for this site in its settings to play on without a click."
    : undefined
}

function ShuffleButton() {
  const shuffle = usePlayer((state) => state.shuffle)

  return (
    <button
      type="button"
      onClick={toggleShuffle}
      aria-label="Shuffle"
      aria-pressed={shuffle}
      className="hidden p-1 text-neutral-400 hover:text-white aria-pressed:text-violet-400 sm:block"
    >
      <ShuffleIcon className="h-4.5 w-4.5" />
    </button>
  )
}

const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: 'Repeat: off',
  all: 'Repeat: the whole queue',
  one: 'Repeat: this track',
}

/** Off, the whole queue, this track: each click moves to the next mode. */
function RepeatButton() {
  const repeat = usePlayer((state) => state.repeat)

  return (
    <button
      type="button"
      onClick={cycleRepeat}
      aria-label={REPEAT_LABELS[repeat]}
      title={REPEAT_LABELS[repeat]}
      className={`hidden p-1 hover:text-white sm:block ${repeat === 'off' ? 'text-neutral-400' : 'text-violet-400'}`}
    >
      {repeat === 'one' ? <RepeatOneIcon className="h-4.5 w-4.5" /> : <RepeatIcon className="h-4.5 w-4.5" />}
    </button>
  )
}

function Volume() {
  const volume = usePlayer((state) => state.volume)
  const muted = usePlayer((state) => state.muted)

  return (
    <div className="hidden items-center gap-2 md:flex">
      <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="p-1 text-neutral-300 hover:text-white">
        {muted || volume === 0 ? <MutedIcon /> : <VolumeIcon />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(event) => setVolume(Number(event.target.value))}
        aria-label="Volume"
        style={{ '--fill': `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
        className="player-slider w-28"
      />
    </div>
  )
}

/** Space does what Play does (`play`); the arrows move in the track, once one is loaded (`loaded`). */
function usePlayerShortcuts(play: () => unknown, loaded: boolean) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) {
        return
      }
      const target = event.target as HTMLElement | null
      // Fields, buttons, links and sliders already do something with these keys.
      if (target?.isContentEditable || target?.closest('input, textarea, select, button, a, [role="slider"]')) {
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        void play()
      } else if (!loaded) {
        return
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        seekBy(-ARROW_SEEK_SECONDS)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        seekBy(ARROW_SEEK_SECONDS)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [play, loaded])
}
