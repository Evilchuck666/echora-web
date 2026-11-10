import { useEffect, type ReactNode } from 'react'
import { Navigate, NavLink } from 'react-router'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { AlbumCard, ArtistCard } from '../components/LibraryCards'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { TrackItem } from '../components/TrackItem'
import { plural } from '../library/format'
import { useFavouriteAlbums, useFavouriteArtists, useFavouriteTracks, type FavouriteKind } from '../library/favourites'
import { playQueue, togglePlay } from '../player/engine'
import { PauseIcon, PlayIcon } from '../player/icons'
import { usePlayer } from '../player/store'

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

/** The origin of a queue made of the favourite tracks. */
const FAVOURITES = 'favourites'

/** The last tab shown, kept in this browser. */
const TAB_KEY = 'echora.favouritesTab'

const TABS: Record<FavouriteKind, string> = { artist: 'artists', album: 'albums', track: 'tracks' }

/** The tab /favourites opens on: the last one shown, else Artists, the first one. */
function rememberedTab(): string {
  try {
    const tab = localStorage.getItem(TAB_KEY)
    return tab && Object.values(TABS).includes(tab) ? tab : TABS.artist
  } catch {
    return TABS.artist
  }
}

/** /favourites (the sidebar's link): to the tab shown last. */
export function FavouritesRedirect() {
  return <Navigate to={`/favourites/${rememberedTab()}`} replace />
}

/** The user's favourite artists, albums or tracks (one tab each, newest first). The tab shown is remembered. */
export function FavouritesPage({ kind }: { kind: FavouriteKind }) {
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, TABS[kind])
    } catch {
      // No storage (a private window): /favourites opens on Artists.
    }
  }, [kind])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Favourites</h1>
      <nav aria-label="Favourites" className="mt-4 mb-6 flex gap-2">
        {/* In the sidebar's order. */}
        <Tab to="/favourites/artists">Artists</Tab>
        <Tab to="/favourites/albums">Albums</Tab>
        <Tab to="/favourites/tracks">Tracks</Tab>
      </nav>
      {kind === 'track' ? <FavouriteTracks /> : kind === 'album' ? <FavouriteAlbums /> : <FavouriteArtists />}
    </main>
  )
}

function Tab({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white aria-[current=page]:border-neutral-100 aria-[current=page]:bg-neutral-100 aria-[current=page]:text-neutral-950"
    >
      {children}
    </NavLink>
  )
}

function FavouriteTracks() {
  const tracks = useFavouriteTracks()
  const members = tracks.data?.pages.flatMap((page) => page.member) ?? []
  const total = tracks.data?.pages[0]?.totalItems
  const isCurrent = usePlayer((state) => state.origin === FAVOURITES && state.index >= 0)
  const playing = usePlayer((state) => state.playing) && isCurrent

  /** Every favourite track, loading the pages not shown yet. */
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

  /** Queues every favourite and plays from the given one: the first, or a random one when shuffle is on. */
  async function playFrom(index?: number) {
    playQueue(await allTracks(), { startIndex: index, origin: FAVOURITES })
  }

  return (
    <List
      query={tracks}
      empty="No favourite tracks yet: press the heart of a track to keep it here."
      header={
        <div className="mb-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => (isCurrent ? togglePlay() : void playFrom())}
            className="inline-flex items-center gap-2 rounded-full bg-violet-600 py-2 pr-5 pl-4 font-medium text-white hover:bg-violet-500"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
            {playing ? 'Pause' : 'Play'}
          </button>
          {total !== undefined && <p className="text-sm text-neutral-400">{plural(total, 'track')}</p>}
        </div>
      }
      count={members.length}
    >
      <ul>
        {members.map((track, index) => (
          <li key={track.id}>
            <TrackItem track={track} onPlay={() => void playFrom(index)} />
          </li>
        ))}
      </ul>
    </List>
  )
}

function FavouriteAlbums() {
  const albums = useFavouriteAlbums()
  const members = albums.data?.pages.flatMap((page) => page.member) ?? []

  return (
    <List query={albums} empty="No favourite albums yet: press the heart on an album's page to keep it here." count={members.length}>
      <ul className={GRID}>
        {members.map((album) => (
          <li key={album.id}>
            <AlbumCard album={album} showArtist />
          </li>
        ))}
      </ul>
    </List>
  )
}

function FavouriteArtists() {
  const artists = useFavouriteArtists()
  const members = artists.data?.pages.flatMap((page) => page.member) ?? []

  return (
    <List query={artists} empty="No favourite artists yet: press the heart on an artist's page to keep them here." count={members.length}>
      <ul className={GRID}>
        {members.map((artist) => (
          <li key={artist.id}>
            <ArtistCard artist={artist} />
          </li>
        ))}
      </ul>
    </List>
  )
}

interface ListProps {
  query: Parameters<typeof InfiniteScrollTrigger>[0] & {
    isPending: boolean
    isLoadingError: boolean
    error: Error | null
    refetch: () => unknown
  }
  /** Shown when there is nothing yet. */
  empty: string
  header?: ReactNode
  count: number
  children: ReactNode
}

/** A list of favourites as it loads: spinner, error, empty message, or the items and more as they are scrolled to. */
function List({ query, empty, header, count, children }: ListProps) {
  if (query.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (query.isLoadingError && query.error) {
    return <QueryError error={query.error} retry={query.refetch} />
  }
  if (count === 0) {
    return <p className="py-12 text-center text-neutral-400">{empty}</p>
  }
  return (
    <>
      {header}
      {children}
      <InfiniteScrollTrigger {...query} />
    </>
  )
}
