import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { TrackItem } from '../components/TrackItem'
import { plural } from '../library/format'
import { useTracks } from '../library/queries'
import { togglePlay } from '../player/engine'
import { PauseIcon, PlayIcon } from '../player/icons'
import { LIBRARY, playLibrary, playLibraryFrom } from '../player/library'
import { usePlayer } from '../player/store'

/**
 * Every track of the library, in its order (album artists by name, their albums by year, disc and track number).
 * Play plays them all (shuffled with shuffle on); a track plays the library from there.
 */
export function TracksPage() {
  const tracks = useTracks()
  const members = tracks.data?.pages.flatMap((page) => page.member) ?? []
  const total = tracks.data?.pages[0]?.totalItems
  const isCurrent = usePlayer((state) => state.origin === LIBRARY && state.index >= 0)
  const playing = usePlayer((state) => state.playing) && isCurrent

  function playFrom(index: number) {
    const loadedPages = tracks.data?.pages.length ?? 0
    void playLibraryFrom(members, index, tracks.hasNextPage ? loadedPages + 1 : undefined)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Tracks</h1>
        <p className="mt-1 text-sm text-neutral-400">{total !== undefined ? plural(total, 'track') : ' '}</p>
      </div>

      {tracks.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : tracks.isLoadingError ? (
        <QueryError error={tracks.error} retry={tracks.refetch} />
      ) : members.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">No tracks yet: scan your music library on the server.</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => (isCurrent ? togglePlay() : void playLibrary())}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-600 py-2 pr-5 pl-4 font-medium text-white hover:bg-violet-500"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <ul>
            {members.map((track, index) => (
              <li key={track.id}>
                <TrackItem track={track} onPlay={() => playFrom(index)} />
              </li>
            ))}
          </ul>
          <InfiniteScrollTrigger {...tracks} />
        </>
      )}
    </main>
  )
}
