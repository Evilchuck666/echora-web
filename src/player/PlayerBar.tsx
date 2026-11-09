import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Cover } from '../components/Cover'
import { formatDuration } from '../library/format'
import { next, previous, seek, seekBy, setVolume, toggleMute, togglePlay } from './engine'
import { MutedIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon, VolumeIcon } from './icons'
import { selectCurrentTrack, usePlayer } from './store'

/** Arrow keys move this many seconds in the track. */
const ARROW_SEEK_SECONDS = 5

/**
 * The player, fixed at the bottom of every signed-in page once something has been played. Space plays and pauses,
 * the left and right arrows move in the track, unless the focus is on something that uses those keys itself.
 */
export function PlayerBar() {
  const track = usePlayer(selectCurrentTrack)
  const playing = usePlayer((state) => state.playing)
  const buffering = usePlayer((state) => state.buffering)
  const error = usePlayer((state) => state.error)
  const hasNext = usePlayer((state) => state.index + 1 < state.queue.length)

  usePlayerShortcuts(track !== undefined)

  if (!track) {
    return null
  }

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
            <Cover url={track.album?.coverUrl} alt="" className="w-12 shrink-0 rounded" />
            <div className="min-w-0">
              <Link to={`/albums/${track.album?.id}`} className="block truncate font-medium hover:underline">
                {track.title}
              </Link>
              {error ? (
                <p role="alert" className="truncate text-sm text-red-400">
                  {error}
                </p>
              ) : (
                <Link to={`/artists/${track.artist?.id}`} className="block truncate text-sm text-neutral-400 hover:underline">
                  {track.artist?.name}
                </Link>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1 md:flex-1">
            <div className="flex items-center gap-2 sm:gap-4">
              <button type="button" onClick={previous} aria-label="Previous" className="hidden p-1 text-neutral-300 hover:text-white sm:block">
                <PreviousIcon />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-950 hover:scale-105"
              >
                {buffering && playing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-950" />
                ) : playing ? (
                  <PauseIcon />
                ) : (
                  <PlayIcon className="ml-0.5 h-5 w-5" />
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
            </div>
            <Progress />
          </div>

          <Volume />
        </div>
      </section>
    </>
  )
}

/** Elapsed time, a slider to move in the track, and the length. The slider only seeks once it is let go. */
function Progress() {
  const currentTime = usePlayer((state) => state.currentTime)
  const duration = usePlayer((state) => state.duration)
  const [dragging, setDragging] = useState<number | null>(null)
  const shown = dragging ?? currentTime

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
        aria-label="Position in the track"
        aria-valuetext={`${formatDuration(shown * 1000)} of ${formatDuration(duration * 1000)}`}
        className="h-1 flex-1 cursor-pointer accent-violet-400"
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

function Volume() {
  const volume = usePlayer((state) => state.volume)
  const muted = usePlayer((state) => state.muted)

  return (
    <div className="hidden w-1/4 items-center justify-end gap-2 md:flex">
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
        className="h-1 w-28 cursor-pointer accent-violet-400"
      />
    </div>
  )
}

function usePlayerShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return
    }
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
        togglePlay()
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
  }, [enabled])
}
