import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { Cover } from '../components/Cover'
import { FavouriteButton } from '../components/FavouriteButton'
import { next, previous, togglePlay } from './engine'
import { CloseIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon } from './icons'
import { closeNowPlaying, NOW_PLAYING_ID, useNowPlaying } from './now-playing'
import { Progress, RepeatButton, ShuffleButton } from './PlayerBar'
import { QueueMenu } from './QueueMenu'
import { selectCurrentTrack, selectHasNext, usePlayer } from './store'
import { useDockedColumn, useFloatingPanelOpen } from './usePanels'

/**
 * Now playing: the current track's cover in large, over a blur of its colours, with its title, artist and album, the
 * heart and the "⋯" menu, and what comes next. It takes the place of the page (the header, the navigation, the
 * docked panels and the player bar stay), and follows the player from one track to the next. On narrow screens it
 * also has the controls the bar has no room for: the position, shuffle, previous and repeat.
 *
 * Opened and closed from the cover in the player bar; Escape and × close it too, and so does going to another page
 * (the album or artist links here, the navigation).
 */
export function NowPlaying() {
  const open = useNowPlaying((state) => state.open)
  const track = usePlayer(selectCurrentTrack)
  const location = useLocation()
  const shownAt = useRef(location.key)

  // Another page was opened: it is shown instead.
  useEffect(() => {
    if (location.key !== shownAt.current) {
      shownAt.current = location.key
      closeNowPlaying()
    }
  }, [location.key])

  if (!open || !track) {
    return null
  }
  return <NowPlayingView />
}

function NowPlayingView() {
  const track = usePlayer(selectCurrentTrack)!
  const playing = usePlayer((state) => state.playing)
  const hasNext = usePlayer(selectHasNext)
  const upNext = usePlayer((state) => (state.repeat === 'one' ? undefined : (state.queue[state.index + 1] ?? (state.repeat === 'all' ? state.queue[0] : undefined))))
  const docked = useDockedColumn()
  const closeButton = useRef<HTMLButtonElement>(null)
  const title = track.title ?? 'Unknown track'
  const cover = track.album?.coverUrl

  useEffect(() => {
    // Into the view; back to the cover in the bar that opened it once it closes.
    const opener = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    return () => {
      if (opener?.isConnected) {
        opener.focus()
      }
    }
  }, [])

  // Escape closes it, wherever the focus is, unless something over it takes the key first: a floating panel (closed
  // first), a menu or a dialog (which stop it), a field (whose Escape empties it).
  const panelOver = useFloatingPanelOpen()
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (event.key === 'Escape' && !event.defaultPrevented && !panelOver && !target?.closest('input:not([type="range"]), textarea, select')) {
        closeNowPlaying()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [panelOver])

  return (
    <section
      id={NOW_PLAYING_ID}
      // Named after the track: the queue panel has a section called "Now playing" too.
      aria-label={`Now playing: ${title}`}
      // Over the page, between the header and the player bar, beside the navigation and the docked panels.
      className={`fixed top-14 bottom-20 left-0 z-9 overflow-hidden bg-neutral-950 lg:left-56 ${docked ? 'right-96' : 'right-0'}`}
    >
      {/* The cover's colours, blurred, behind; it stays put while the view scrolls. */}
      {cover && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <img src={cover} alt="" className="h-full w-full scale-125 object-cover opacity-35 blur-3xl" />
          <div className="absolute inset-0 bg-linear-to-b from-neutral-950/20 via-neutral-950/60 to-neutral-950" />
        </div>
      )}
      <button
        ref={closeButton}
        type="button"
        onClick={closeNowPlaying}
        aria-label="Close Now playing"
        className="absolute top-3 right-3 z-1 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950/60 text-neutral-300 hover:text-white"
      >
        <CloseIcon />
      </button>

      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="relative mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-6 py-10">
          <Cover url={cover} alt={`Cover of ${track.album?.title ?? title}`} className="mx-auto w-full max-w-[min(100%,52svh)] rounded-lg shadow-2xl shadow-black/60" />

          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h2>
              <p className="mt-1 text-neutral-300">
                <Link to={`/artists/${track.artist?.id}`} className="hover:underline">
                  {track.artist?.name}
                </Link>
                {track.album?.title && (
                  <>
                    <span className="text-neutral-500"> · </span>
                    <Link to={`/albums/${track.album.id}`} className="hover:underline">
                      {track.album.title}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <FavouriteButton kind="track" id={track.id} favourite={track.favourite} name={title} className="h-10 w-10 shrink-0" iconClassName="h-6 w-6" />
            <QueueMenu name={title} tracks={() => [track]} track={track} className="shrink-0 pt-1" />
          </div>

          {/* The bar has no room for these on narrow screens. */}
          <div className="flex flex-col gap-3 sm:hidden">
            <Progress disabled={false} className="flex w-full" />
            <div className="flex items-center justify-between px-2">
              <ShuffleButton className="block" />
              <button type="button" onClick={previous} aria-label="Previous" className="p-2 text-neutral-200 hover:text-white">
                <PreviousIcon className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-950 hover:scale-105"
              >
                {playing ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="ml-1 h-7 w-7" />}
              </button>
              <button type="button" onClick={next} disabled={!hasNext} aria-label="Next" className="p-2 text-neutral-200 hover:text-white disabled:opacity-30">
                <NextIcon className="h-7 w-7" />
              </button>
              <RepeatButton className="block" />
            </div>
          </div>

          {upNext && (
            <p className="truncate text-sm text-neutral-400">
              <span className="text-xs font-medium tracking-wider text-neutral-500 uppercase">Next </span>
              {upNext.track.title}
              {upNext.track.artist?.name && <span className="text-neutral-500"> · {upNext.track.artist.name}</span>}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
