import { useState } from 'react'
import { ActionsMenu } from '../components/ActionsMenu'
import { AddToPlaylistDialog } from '../components/PlaylistDialogs'
import { showToast } from '../components/toast'
import { addToQueue, playNext } from './engine'
import { LyricsDialog } from './LyricsDialog'
import type { PlayerTrack } from './store'

// "Play next" and "Add to queue" for tracks and albums, so the queue grows without being replaced; "Add to playlist",
// in a dialog; and for a track with lyrics, "Show lyrics", to read them without playing it.

/** Queues `tracks` after the current one or at the end, and says so; `name` is what they are, e.g. the album title. */
function queueTracks(tracks: PlayerTrack[], where: 'next' | 'end', name: string): void {
  if (tracks.length === 0) {
    return
  }
  if (where === 'next') {
    playNext(tracks)
    showToast(`“${name}” will play next`)
  } else {
    addToQueue(tracks)
    showToast(`“${name}” added to the queue`)
  }
}

interface QueueMenuProps {
  /** What is queued, as the menu calls it ("More options for …") and the toast says it. */
  name: string
  /** The tracks to queue; may load them first (every track of an album). */
  tracks: () => PlayerTrack[] | Promise<PlayerTrack[]>
  /** The track, when the menu is one track's: "Show lyrics" if it has any. */
  track?: PlayerTrack
  className?: string
}

/** A "⋯" menu with Play next, Add to queue, Add to playlist and, for one track with lyrics, Show lyrics. */
export function QueueMenu({ name, tracks, track, className }: QueueMenuProps) {
  const [addingToPlaylist, setAddingToPlaylist] = useState(false)
  const [readingLyrics, setReadingLyrics] = useState(false)

  async function queue(where: 'next' | 'end') {
    try {
      queueTracks(await tracks(), where, name)
    } catch {
      showToast(`Couldn't load the tracks of “${name}”.`)
    }
  }

  return (
    <>
      <ActionsMenu
        label={`More options for ${name}`}
        actions={[
          { label: 'Play next', onSelect: () => queue('next') },
          { label: 'Add to queue', onSelect: () => queue('end') },
          { label: 'Add to playlist…', onSelect: () => setAddingToPlaylist(true) },
          ...(track?.hasLyrics ? [{ label: 'Show lyrics', onSelect: () => setReadingLyrics(true) }] : []),
        ]}
        className={className}
      />
      {addingToPlaylist && <AddToPlaylistDialog name={name} tracks={tracks} onClose={() => setAddingToPlaylist(false)} />}
      {readingLyrics && track && <LyricsDialog track={track} onClose={() => setReadingLyrics(false)} />}
    </>
  )
}
