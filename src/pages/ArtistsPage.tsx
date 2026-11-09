import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { ArtistCard } from '../components/LibraryCards'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { plural } from '../library/format'
import { useArtists } from '../library/queries'

/** Every artist, by name. Searching is done from the header (SearchBox, SearchPage). */
export function ArtistsPage() {
  const artists = useArtists()
  const members = artists.data?.pages.flatMap((page) => page.member) ?? []
  const total = artists.data?.pages[0]?.totalItems

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Artists</h1>
        <p className="mt-1 text-sm text-neutral-400">{total !== undefined ? plural(total, 'artist') : '\u00a0'}</p>
      </div>

      {artists.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : artists.isLoadingError ? (
        <QueryError error={artists.error} retry={artists.refetch} />
      ) : members.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">
          No artists yet: scan your music library on the server.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {members.map((artist) => (
              <li key={artist.id}>
                <ArtistCard artist={artist} />
              </li>
            ))}
          </ul>
          <InfiniteScrollTrigger {...artists} />
        </>
      )}
    </main>
  )
}
