import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { useLyrics } from '../library/queries'
import { PlayerPanel } from './PlayerPanel'
import type { PlayerTrack } from './store'

export const LYRICS_PANEL_ID = 'lyrics-panel'

interface LyricsPanelProps {
  track: PlayerTrack
  onClose: () => void
  /** A section of the column at the right of the page (see usePanels). */
  docked?: boolean
  /** Floating, with the queue panel open too: sit to its left. */
  beside?: boolean
}

/** The lyrics of the track that is playing. It follows the player: the next track brings its own, or says it has none. */
export function LyricsPanel({ track, onClose, docked, beside }: LyricsPanelProps) {
  // Lists already say whether there are lyrics: no need to ask the API for a track without them.
  const lyrics = useLyrics(track.hasLyrics === false ? undefined : track.id)

  return (
    <PlayerPanel id={LYRICS_PANEL_ID} label="Lyrics" title={track.title} subtitle={track.artist?.name} onClose={onClose} docked={docked} beside={beside}>
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
    </PlayerPanel>
  )
}
