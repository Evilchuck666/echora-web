import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { AlbumCard } from '../components/LibraryCards'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { plural } from '../library/format'
import { useAlbums } from '../library/queries'

/** Every album of the library, by year and title, with its artist. */
export function AlbumsPage() {
  const albums = useAlbums()
  const members = albums.data?.pages.flatMap((page) => page.member) ?? []
  const total = albums.data?.pages[0]?.totalItems

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Albums</h1>
        <p className="mt-1 text-sm text-neutral-400">{total !== undefined ? plural(total, 'album') : ' '}</p>
      </div>

      {albums.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : albums.isLoadingError ? (
        <QueryError error={albums.error} retry={albums.refetch} />
      ) : members.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">No albums yet: scan your music library on the server.</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {members.map((album) => (
              <li key={album.id}>
                <AlbumCard album={album} showArtist />
              </li>
            ))}
          </ul>
          <InfiniteScrollTrigger {...albums} />
        </>
      )}
    </main>
  )
}
