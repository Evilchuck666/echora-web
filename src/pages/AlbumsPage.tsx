import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { AlbumCard } from '../components/LibraryCards'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { plural } from '../library/format'
import { timeAgo } from '../library/format'
import { useAlbums, useRecentlyAddedAlbums } from '../library/queries'

/**
 * Every album of the library, with its artist: in the library's order (artist after artist, each one's by year), or
 * the most recently added first (`recent`: the home page).
 */
export function AlbumsPage({ recent = false }: { recent?: boolean }) {
  return recent ? <RecentlyAddedAlbums /> : <AllAlbums />
}

function AllAlbums() {
  return <AlbumList title="Albums" query={useAlbums()} />
}

function RecentlyAddedAlbums() {
  return <AlbumList title="Recently added" query={useRecentlyAddedAlbums()} recent />
}

interface AlbumListProps {
  title: string
  query: ReturnType<typeof useAlbums> | ReturnType<typeof useRecentlyAddedAlbums>
  recent?: boolean
}

function AlbumList({ title, query: albums, recent = false }: AlbumListProps) {
  const members = albums.data?.pages.flatMap((page) => page.member) ?? []
  const total = albums.data?.pages[0]?.totalItems

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
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
                {recent && album.addedAt && <p className="text-xs text-neutral-500">Added {timeAgo(album.addedAt)}</p>}
              </li>
            ))}
          </ul>
          <InfiniteScrollTrigger {...albums} />
        </>
      )}
    </main>
  )
}
