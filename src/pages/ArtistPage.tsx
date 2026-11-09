import { Link, useParams } from 'react-router'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Cover } from '../components/Cover'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { plural } from '../library/format'
import { useArtist, useArtistAlbums } from '../library/queries'
import type { Album } from '../library/types'

export function ArtistPage() {
  const { id = '' } = useParams()
  const artist = useArtist(id)
  const albums = useArtistAlbums(id)
  const members = albums.data?.pages.flatMap((page) => page.member) ?? []
  const total = albums.data?.pages[0]?.totalItems

  if (artist.isLoadingError) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Breadcrumbs items={[{ label: 'Artists', to: '/' }]} />
        <QueryError error={artist.error} retry={artist.refetch} notFound="This artist isn't in the library." />
      </main>
    )
  }

  const name = artist.data?.name ?? ''

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ label: 'Artists', to: '/' }, { label: name }]} />
      <h1 className="text-3xl font-semibold tracking-tight">{name || ' '}</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-400">{total !== undefined ? plural(total, 'album') : ' '}</p>

      {albums.isPending || artist.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : albums.isLoadingError ? (
        <QueryError error={albums.error} retry={albums.refetch} />
      ) : members.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">
          No albums of their own: this artist only appears on tracks of other artists' albums.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {members.map((album) => (
              <li key={album.id}>
                <AlbumCard album={album} />
              </li>
            ))}
          </ul>
          <InfiniteScrollTrigger {...albums} />
        </>
      )}
    </main>
  )
}

function AlbumCard({ album }: { album: Album }) {
  const title = album.title ?? 'Unknown album'

  return (
    <Link to={`/albums/${album.id}`} className="group block">
      <Cover url={album.coverUrl} alt={`Cover of ${title}`} className="w-full rounded-md group-hover:opacity-80" />
      <p className="mt-2 truncate font-medium group-hover:text-violet-300" title={title}>
        {title}
      </p>
      <p className="text-sm text-neutral-400">{album.year ?? 'Unknown year'}</p>
    </Link>
  )
}
