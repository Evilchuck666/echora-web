import { Link } from 'react-router'
import { albumIri, fetchAllTracks } from '../library/queries'
import { QueueMenu } from '../player/QueueMenu'
import { ArtistImage } from './ArtistImage'
import { Cover } from './Cover'

// Typed by the fields they show, so artists and albums from the lists and from the search both fit.

interface ArtistSummary {
  id?: string
  name?: string
  coverUrl?: string | null
}

interface AlbumSummary {
  id?: string
  title?: string
  year?: number | null
  coverUrl?: string | null
  artist?: { name?: string }
}

/** An artist's round thumbnail and name, linking to the artist. */
export function ArtistCard({ artist }: { artist: ArtistSummary }) {
  const name = artist.name ?? 'Unknown artist'

  return (
    <Link to={`/artists/${artist.id}`} className="group block text-center">
      <ArtistImage url={artist.coverUrl} name={name} className="w-full text-5xl group-hover:opacity-80" />
      <p className="mt-2 truncate font-medium group-hover:text-violet-300" title={name}>
        {name}
      </p>
    </Link>
  )
}

/**
 * An album's cover, title and year, linking to the album; with its artist too where albums of several are mixed.
 * A "⋯" menu over the cover queues the whole album.
 */
export function AlbumCard({ album, showArtist = false }: { album: AlbumSummary; showArtist?: boolean }) {
  const title = album.title ?? 'Unknown album'
  const year = album.year ?? 'Unknown year'
  const id = album.id

  return (
    <div className="group relative">
      <Link to={`/albums/${id}`} className="block">
        <Cover url={album.coverUrl} alt={`Cover of ${title}`} className="w-full rounded-md group-hover:opacity-80" />
        <p className="mt-2 truncate font-medium group-hover:text-violet-300" title={title}>
          {title}
        </p>
        <p className="truncate text-sm text-neutral-400">{showArtist ? `${album.artist?.name ?? 'Unknown artist'} · ${year}` : year}</p>
      </Link>
      {id && (
        <QueueMenu
          name={title}
          tracks={() => fetchAllTracks({ album: albumIri(id) })}
          className="absolute top-2 right-2 rounded-full bg-neutral-950/80 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 has-aria-expanded:opacity-100"
        />
      )}
    </div>
  )
}
