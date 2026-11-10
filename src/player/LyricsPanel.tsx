import { useEffect } from 'react'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { useLyrics } from '../library/queries'
import { CloseIcon } from './icons'
import type { PlayerTrack } from './store'

export const LYRICS_PANEL_ID = 'lyrics-panel'

interface LyricsPanelProps {
  track: PlayerTrack
  onClose: () => void
}

/**
 * The lyrics of the track that is playing, above the player bar. It follows the player: the next track brings its
 * own lyrics, or says it has none. Escape closes it, unless it is leaving a field (the search box).
 */
export function LyricsPanel({ track, onClose }: LyricsPanelProps) {
  // Lists already say whether there are lyrics: no need to ask the API for a track without them.
  const lyrics = useLyrics(track.hasLyrics === false ? undefined : track.id)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (event.key === 'Escape' && !event.defaultPrevented && !target?.closest('input:not([type="range"]), textarea, select')) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <aside
      id={LYRICS_PANEL_ID}
      aria-label="Lyrics"
      className="fixed inset-x-2 top-16 bottom-22 z-20 flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/95 shadow-2xl backdrop-blur sm:inset-x-auto sm:top-auto sm:right-4 sm:max-h-[min(40rem,calc(100svh-8rem))] sm:w-96"
    >
      <div className="flex items-start gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{track.title}</h2>
          <p className="truncate text-sm text-neutral-400">{track.artist?.name}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the lyrics" className="-mr-1 p-1 text-neutral-400 hover:text-white">
          <CloseIcon />
        </button>
      </div>
      {/* A new track starts at the top of its lyrics. */}
      <div key={track.id} className="flex-1 overflow-y-auto px-4 py-4">
        {track.hasLyrics === false || lyrics.data === null ? (
          <p className="py-8 text-center text-neutral-400">This track has no lyrics.</p>
        ) : lyrics.isLoadingError ? (
          <QueryError error={lyrics.error} retry={lyrics.refetch} />
        ) : lyrics.data === undefined ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <p className="leading-relaxed whitespace-pre-line text-neutral-200">{lyrics.data}</p>
        )}
      </div>
    </aside>
  )
}
