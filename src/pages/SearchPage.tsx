import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { AlbumCard, ArtistCard } from '../components/LibraryCards'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { TrackItem } from '../components/TrackItem'
import { plural } from '../library/format'
import { SEARCH_LIMIT, useSearch } from '../library/queries'
import { useLeaveSearch } from '../library/search'

/** How many results each section shows before "Show all": one row of cards at full width. */
const COLLAPSED = { artists: 6, albums: 6, tracks: 5 }

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

/** Results of the search typed in the header (SearchBox): artists, albums and tracks at once. */
export function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()
  const search = useSearch(query)
  const leaveSearch = useLeaveSearch()
  const left = useRef(false)

  // /search, /search?q= or a blank query (typed or bookmarked): not a page of its own, go back to the last valid
  // one. Once only: React's development mode runs effects twice, and going back twice would skip a page.
  useEffect(() => {
    if (query) {
      left.current = false
    } else if (!left.current) {
      left.current = true
      leaveSearch()
    }
  }, [query, leaveSearch])

  if (!query) {
    return null
  }

  const data = search.data

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">
        Results for <span className="text-violet-300">“{query}”</span>
      </h1>

      {search.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner label="Searching" />
        </div>
      ) : search.isLoadingError ? (
        <QueryError error={search.error} retry={search.refetch} />
      ) : !data || (data.totalArtists ?? 0) + (data.totalAlbums ?? 0) + (data.totalTracks ?? 0) === 0 ? (
        <p className="py-12 text-center text-neutral-400">Nothing in the library matches “{query}”.</p>
      ) : (
        // The previous results stay, dimmed, while the next query loads. Keyed by query: sections fold again.
        <div key={data.query} className={`flex flex-col gap-10 ${search.isPlaceholderData ? 'opacity-60' : ''}`}>
          <Section title="Artists" items={data.artists ?? []} total={data.totalArtists ?? 0} collapsed={COLLAPSED.artists}>
            {(artists) => (
              <ul className={GRID}>
                {artists.map((artist) => (
                  <li key={artist.id}>
                    <ArtistCard artist={artist} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Albums" items={data.albums ?? []} total={data.totalAlbums ?? 0} collapsed={COLLAPSED.albums}>
            {(albums) => (
              <ul className={GRID}>
                {albums.map((album) => (
                  <li key={album.id}>
                    <AlbumCard album={album} showArtist />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Tracks" items={data.tracks ?? []} total={data.totalTracks ?? 0} collapsed={COLLAPSED.tracks}>
            {(tracks) => (
              <ol className="divide-y divide-neutral-800/70">
                {tracks.map((track) => (
                  <li key={track.id}>
                    <TrackItem track={track} />
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      )}
    </main>
  )
}

interface SectionProps<T> {
  title: string
  items: T[]
  /** Every match, including the ones beyond the items returned. */
  total: number
  collapsed: number
  children: (items: T[]) => ReactNode
}

/** A kind of result, folded to its best matches until "Show all". Left out when nothing of its kind matches. */
function Section<T>({ title, items, total, collapsed, children }: SectionProps<T>) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return null
  }

  const shown = expanded ? items : items.slice(0, collapsed)

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold">
          {title} <span className="text-sm font-normal text-neutral-400">{total}</span>
        </h2>
        {items.length > collapsed && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-sm text-violet-400 hover:underline">
            {expanded ? 'Show less' : `Show all (${items.length})`}
          </button>
        )}
      </div>
      {children(shown)}
      {expanded && total > items.length && (
        <p className="mt-3 text-sm text-neutral-400">
          Showing the best {SEARCH_LIMIT} of {plural(total, title.toLowerCase().replace(/s$/, ''))}. Add words to narrow the search.
        </p>
      )}
    </section>
  )
}
