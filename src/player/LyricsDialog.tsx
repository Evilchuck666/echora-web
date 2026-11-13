import { Dialog } from '../components/Dialog'
import { LyricsText } from './LyricsText'
import type { PlayerTrack } from './store'

/**
 * The lyrics of any track, read without playing it (from its "⋯" menu, or the album page's "Lyrics" badge). The
 * player is left alone; the lyrics panel only ever shows the track that plays.
 */
export function LyricsDialog({ track, onClose }: { track: PlayerTrack; onClose: () => void }) {
  return (
    <Dialog title={`Lyrics of “${track.title ?? 'Unknown track'}”`} onClose={onClose}>
      {track.artist?.name && <p className="-mt-1 mb-4 text-sm text-neutral-400">{track.artist.name}</p>}
      <LyricsText track={track} />
    </Dialog>
  )
}
