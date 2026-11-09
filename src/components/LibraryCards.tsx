import { Link } from 'react-router'
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

/** An album's cover, title and year, linking to the album; with its artist too where albums of several are mixed. */
export function AlbumCard({ album, showArtist = false }: { album: AlbumSummary; showArtist?: boolean }) {
  const title = album.title ?? 'Unknown album'
  const year = album.year ?? 'Unknown year'

  return (
    <Link to={`/albums/${album.id}`} className="group block">
      <Cover url={album.coverUrl} alt={`Cover of ${title}`} className="w-full rounded-md group-hover:opacity-80" />
      <p className="mt-2 truncate font-medium group-hover:text-violet-300" title={title}>
        {title}
      </p>
      <p className="truncate text-sm text-neutral-400">{showArtist ? `${album.artist?.name ?? 'Unknown artist'} · ${year}` : year}</p>
    </Link>
  )
}
