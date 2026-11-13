import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatDuration } from '../library/format'
import { playQueue, togglePlay } from '../player/engine'
import { NowPlayingIcon, PauseIcon, PlayIcon } from '../player/icons'
import { QueueMenu } from '../player/QueueMenu'
import { selectCurrentTrack, usePlayer, type PlayerTrack } from '../player/store'
import { Cover } from './Cover'
import { FavouriteButton } from './FavouriteButton'

/** A track with the fields this row shows: search results and favourites both fit. */
type ItemTrack = PlayerTrack & { favourite?: boolean }

/** Shown on hover or focus (and always on touch screens), like the "⋯" menu: the row stays quiet otherwise. */
export const ON_HOVER = 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100'

interface TrackItemProps {
  track: ItemTrack
  /** What its play button does: play this track alone, unless given (e.g. play every favourite from this one). */
  onPlay?: () => void
  /** Shown first in the row, e.g. a handle to drag it. */
  before?: ReactNode
  /** Shown last in the row, e.g. a button to remove it from a playlist. */
  after?: ReactNode
  /** A short fact shown before the heart on wider screens, e.g. "3 plays · yesterday". */
  note?: ReactNode
}

/**
 * A track among others of various albums: its album cover (a play button on hover), title, artist and album (links),
 * a heart, its length and a "⋯" menu. The track loaded in the player is highlighted.
 */
export function TrackItem({ track, onPlay = () => playQueue([track]), before, after, note }: TrackItemProps) {
  const album = track.album
  const current = usePlayer((state) => selectCurrentTrack(state)?.id === track.id)
  const nowPlaying = usePlayer((state) => state.playing) && current
  const title = track.title ?? 'Unknown track'

  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-neutral-900">
      {before}
      <button
        type="button"
        onClick={() => (current ? togglePlay() : onPlay())}
        aria-label={`${nowPlaying ? 'Pause' : 'Play'} ${track.title}`}
        className="relative w-10 shrink-0"
      >
        <Cover url={album?.coverUrl} alt="" className="w-10 rounded" />
        <span className="absolute inset-0 hidden items-center justify-center rounded bg-black/60 group-focus-within:flex group-hover:flex">
          {nowPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
        </span>
        {nowPlaying && (
          <span className="absolute inset-0 flex items-center justify-center rounded bg-black/60 text-violet-300 group-focus-within:hidden group-hover:hidden">
            <NowPlayingIcon className="h-4 w-4" />
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <Link to={`/albums/${album?.id}`} className={`block truncate hover:underline ${current ? 'text-violet-300' : ''}`}>
          {track.title}
        </Link>
        <p className="truncate text-sm text-neutral-400">
          <Link to={`/artists/${track.artist?.id}`} className="hover:underline">
            {track.artist?.name}
          </Link>
          {' · '}
          <Link to={`/albums/${album?.id}`} className="hover:underline">
            {album?.title}
          </Link>
        </p>
      </div>
      {note && <span className="hidden shrink-0 text-sm text-neutral-400 sm:block">{note}</span>}
      <FavouriteButton
        kind="track"
        id={track.id}
        favourite={track.favourite}
        name={title}
        className={`h-8 w-8 shrink-0 ${ON_HOVER} aria-pressed:opacity-100`}
        iconClassName="h-4.5 w-4.5"
      />
      <span className="w-12 shrink-0 text-right text-sm text-neutral-400 tabular-nums">
        {typeof track.durationMs === 'number' ? formatDuration(track.durationMs) : ''}
      </span>
      <QueueMenu name={title} tracks={() => [track]} track={track} className={`shrink-0 ${ON_HOVER} has-aria-expanded:opacity-100`} />
      {after}
    </div>
  )
}
