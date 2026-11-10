import { Link, useParams } from 'react-router'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Cover } from '../components/Cover'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { formatDuration, plural } from '../library/format'
import { useAlbum, useAlbumTracks } from '../library/queries'
import type { Album, Track } from '../library/types'
import { playQueue, togglePlay } from '../player/engine'
import { NowPlayingIcon, PauseIcon, PlayIcon } from '../player/icons'
import { QueueMenu } from '../player/QueueMenu'
import { selectCurrentTrack, usePlayer } from '../player/store'

export function AlbumPage() {
  const { id = '' } = useParams()
  const album = useAlbum(id)
  const tracks = useAlbumTracks(id)
  const currentTrack = usePlayer(selectCurrentTrack)
  const playing = usePlayer((state) => state.playing)

  if (album.isLoadingError) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Breadcrumbs items={[{ label: 'Artists', to: '/' }]} />
        <QueryError error={album.error} retry={album.refetch} notFound="This album isn't in the library." />
      </main>
    )
  }

  if (album.isPending) {
    return (
      <main className="flex justify-center px-4 py-18">
        <Spinner />
      </main>
    )
  }

  const title = album.data.title ?? 'Unknown album'
  const artist = album.data.artist
  const members = tracks.data?.pages.flatMap((page) => page.member) ?? []
  const total = tracks.data?.pages[0]?.totalItems
  const albumIsCurrent = currentTrack?.album?.id === id

  /** Every track of the album, loading the pages not shown yet. */
  async function allTracks() {
    if (!tracks.hasNextPage) {
      return members
    }
    let result = await tracks.fetchNextPage()
    while (result.hasNextPage && !result.isFetchNextPageError) {
      result = await result.fetchNextPage()
    }
    return result.data?.pages.flatMap((page) => page.member) ?? members
  }

  /** Queues the whole album and plays from the given track: the first, or a random one when shuffle is on. */
  async function playFrom(index?: number) {
    playQueue(await allTracks(), { startIndex: index, origin: `album:${id}` })
  }

  function playTrack(index: number) {
    if (members[index]?.id === currentTrack?.id) {
      togglePlay()
    } else {
      void playFrom(index)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <Breadcrumbs
        items={[
          { label: 'Artists', to: '/' },
          ...(artist ? [{ label: artist.name ?? 'Unknown artist', to: `/artists/${artist.id}` }] : []),
          { label: title },
        ]}
      />

      <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end">
        <Cover url={album.data.coverUrl} alt={`Cover of ${title}`} className="w-48 shrink-0 rounded-lg shadow-lg sm:w-56" />
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wider text-neutral-400 uppercase">Album</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-neutral-300">
            {artist && (
              <Link to={`/artists/${artist.id}`} className="font-medium hover:underline">
                {artist.name}
              </Link>
            )}
            <AlbumFacts album={album.data} trackCount={total} tracks={tracks.hasNextPage ? undefined : members} />
          </p>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (albumIsCurrent ? togglePlay() : void playFrom())}
              disabled={members.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 py-2 pr-5 pl-4 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {albumIsCurrent && playing ? <PauseIcon /> : <PlayIcon />}
              {albumIsCurrent && playing ? 'Pause' : 'Play'}
            </button>
            {members.length > 0 && <QueueMenu name={title} tracks={allTracks} />}
          </div>
        </div>
      </header>

      {tracks.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : tracks.isLoadingError ? (
        <QueryError error={tracks.error} retry={tracks.refetch} />
      ) : members.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">This album has no tracks.</p>
      ) : (
        <>
          <TrackList
            tracks={members}
            album={album.data}
            currentTrackId={currentTrack?.id}
            playing={playing}
            onPlay={playTrack}
          />
          <InfiniteScrollTrigger {...tracks} />
        </>
      )}
    </main>
  )
}

/** " · 1983 · 9 tracks · 41:52": the total length only once every track is loaded. */
function AlbumFacts({ album, trackCount, tracks }: { album: Album; trackCount?: number; tracks?: Track[] }) {
  const facts: string[] = []
  if (album.year) {
    facts.push(String(album.year))
  }
  if (trackCount !== undefined) {
    facts.push(plural(trackCount, 'track'))
  }
  if (tracks && tracks.length > 0 && tracks.every((track) => typeof track.durationMs === 'number')) {
    facts.push(formatDuration(tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0)))
  }
  return facts.map((fact) => <span key={fact} className="text-neutral-400">{` · ${fact}`}</span>)
}

interface TrackListProps {
  tracks: Track[]
  album: Album
  currentTrackId?: string
  playing: boolean
  onPlay: (index: number) => void
}

function TrackList({ tracks, album, currentTrackId, playing, onPlay }: TrackListProps) {
  // Disc headings only when the album has more than one disc.
  const discs = new Set(tracks.map((track) => track.discNumber ?? 1))
  const showDiscs = discs.size > 1

  return (
    <ol className="divide-y divide-neutral-800/70">
      {tracks.map((track, index) => {
        const disc = track.discNumber ?? 1
        const startsDisc = showDiscs && (index === 0 || (tracks[index - 1].discNumber ?? 1) !== disc)
        return (
          <li key={track.id}>
            {startsDisc && (
              <h2 className="pt-6 pb-2 text-sm font-medium tracking-wider text-neutral-400 uppercase">Disc {disc}</h2>
            )}
            <TrackRow
              track={track}
              albumArtistId={album.artist?.id}
              current={track.id === currentTrackId}
              playing={playing}
              onPlay={() => onPlay(index)}
            />
          </li>
        )
      })}
    </ol>
  )
}

interface TrackRowProps {
  track: Track
  albumArtistId?: string
  /** The track loaded in the player, playing or paused. */
  current: boolean
  playing: boolean
  onPlay: () => void
}

/** A track: its number turns into a play button on hover, a double click plays it, the one loaded is highlighted. */
function TrackRow({ track, albumArtistId, current, playing, onPlay }: TrackRowProps) {
  // On compilations, each track keeps its own artist.
  const showArtist = track.artist && track.artist.id !== albumArtistId
  const nowPlaying = current && playing

  return (
    <div
      onDoubleClick={onPlay}
      className={`group flex items-center gap-4 rounded-md px-2 py-2.5 select-none hover:bg-neutral-900 ${current ? 'bg-neutral-900/60' : ''}`}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-label={`${nowPlaying ? 'Pause' : 'Play'} ${track.title}`}
        className="flex w-6 shrink-0 justify-end text-sm tabular-nums"
      >
        <span className={`group-focus-within:hidden group-hover:hidden ${current ? 'text-violet-400' : 'text-neutral-500'}`}>
          {nowPlaying ? <NowPlayingIcon className="h-4 w-4" /> : (track.trackNumber ?? '–')}
        </span>
        <span className="hidden text-neutral-100 group-focus-within:block group-hover:block">
          {nowPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate ${current ? 'text-violet-300' : ''}`}>{track.title}</p>
        {showArtist && (
          <Link to={`/artists/${track.artist?.id}`} className="truncate text-sm text-neutral-400 hover:underline">
            {track.artist?.name}
          </Link>
        )}
      </div>
      {track.hasLyrics && (
        <span title="Has lyrics" className="shrink-0 rounded border border-neutral-700 px-1.5 text-xs text-neutral-400">
          Lyrics
        </span>
      )}
      <span className="w-12 shrink-0 text-right text-sm text-neutral-400 tabular-nums">
        {typeof track.durationMs === 'number' ? formatDuration(track.durationMs) : ''}
      </span>
      <QueueMenu
        name={track.title ?? 'Unknown track'}
        tracks={() => [track]}
        className="-my-1 shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 has-aria-expanded:opacity-100"
      />
    </div>
  )
}
