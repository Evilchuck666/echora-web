import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { plural } from '../library/format'
import { useArtists } from '../library/queries'
import type { Artist } from '../library/types'

export function ArtistsPage() {
  // The search lives in the URL (?q=), so it survives going into an artist and back.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(query)
  const debouncedSearch = useDebouncedValue(search.trim())

  useEffect(() => {
    if (debouncedSearch !== query) {
      setSearchParams(debouncedSearch ? { q: debouncedSearch } : {}, { replace: true })
    }
  }, [debouncedSearch, query, setSearchParams])

  const artists = useArtists(query)
  const members = artists.data?.pages.flatMap((page) => page.member) ?? []
  const total = artists.data?.pages[0]?.totalItems

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Artists</h1>
          {total !== undefined && <p className="mt-1 text-sm text-neutral-400">{plural(total, 'artist')}</p>}
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search artists"
          aria-label="Search artists"
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500 sm:w-72"
        />
      </div>

      {artists.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : artists.isLoadingError ? (
        <QueryError error={artists.error} retry={artists.refetch} />
      ) : members.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">
          {query ? `No artists match “${query}”.` : 'No artists yet: scan your music library on the server.'}
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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

function ArtistCard({ artist }: { artist: Artist }) {
  const name = artist.name ?? 'Unknown artist'

  return (
    <Link
      to={`/artists/${artist.id}`}
      className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3 hover:border-neutral-600"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-900/60 font-semibold text-violet-200"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="truncate font-medium">{name}</span>
    </Link>
  )
}
