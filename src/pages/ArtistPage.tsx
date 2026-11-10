import { useState } from 'react'
import { useParams } from 'react-router'
import { ArtistImage } from '../components/ArtistImage'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { AlbumCard } from '../components/LibraryCards'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { showToast } from '../components/toast'
import { plural } from '../library/format'
import { artistIri, fetchAllTracks, useArtist, useArtistAlbums } from '../library/queries'
import { playQueue, togglePlay } from '../player/engine'
import { PauseIcon, PlayIcon } from '../player/icons'
import { usePlayer } from '../player/store'

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
      <header className="mb-8 flex items-center gap-5 sm:gap-6">
        {artist.data && (
          <ArtistImage url={artist.data.coverUrl} name={name} className="w-24 shrink-0 text-4xl shadow-lg sm:w-36 sm:text-6xl" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wider text-neutral-400 uppercase">Artist</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{name || ' '}</h1>
          <p className="mt-1 text-sm text-neutral-400">{total !== undefined ? plural(total, 'album') : ' '}</p>
          {members.length > 0 && <PlayAllButton artistId={id} name={name} />}
        </div>
      </header>

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

/**
 * Plays every track of the artist's albums, album after album in the order shown (the API sorts them), from the
 * first or, with shuffle on, a random one. While those play, it pauses and resumes them.
 */
function PlayAllButton({ artistId, name }: { artistId: string; name: string }) {
  const origin = `artist:${artistId}`
  const isCurrent = usePlayer((state) => state.origin === origin && state.index >= 0)
  const playing = usePlayer((state) => state.playing) && isCurrent
  const [loading, setLoading] = useState(false)

  async function playAll() {
    setLoading(true)
    try {
      playQueue(await fetchAllTracks({ albumArtist: artistIri(artistId) }), { origin })
    } catch {
      showToast(`Couldn't load the tracks of ${name}.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => (isCurrent ? togglePlay() : void playAll())}
      disabled={loading}
      className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-600 py-2 pr-5 pl-4 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
      {playing ? 'Pause' : 'Play all'}
    </button>
  )
}
