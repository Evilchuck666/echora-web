import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { createPlaylist, usePlaylists } from '../library/playlists'
import { ArtistsIcon, HeartIcon, PlaylistIcon, PlusIcon } from '../player/icons'
import { InfiniteScrollTrigger } from './InfiniteScrollTrigger'
import { PlaylistNameDialog } from './PlaylistDialogs'

const LINK =
  'flex items-center gap-3 rounded-md px-3 py-2 text-neutral-300 hover:bg-neutral-900 hover:text-white aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white'

interface NavItemProps {
  to: string
  icon: ReactNode
  children: ReactNode
  /** Only active on this exact path (the home page). */
  end?: boolean
}

function NavItem({ to, icon, children, end }: NavItemProps) {
  return (
    <li>
      <NavLink to={to} end={end} className={LINK}>
        <span className="shrink-0 text-neutral-400">{icon}</span>
        <span className="truncate">{children}</span>
      </NavLink>
    </li>
  )
}

/** The places of the app, and the user's playlists: the sidebar of large screens and the drawer of small ones. */
export function Navigation() {
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Library">
        <ul className="flex flex-col gap-1">
          <NavItem to="/" end icon={<ArtistsIcon />}>
            Artists
          </NavItem>
          <NavItem to="/favourites" icon={<HeartIcon />}>
            Favourites
          </NavItem>
        </ul>
      </nav>
      <Playlists />
    </div>
  )
}

/** The user's playlists, the most recently changed first, and a button to make one (which then opens). */
function Playlists() {
  const playlists = usePlaylists()
  const members = playlists.data?.pages.flatMap((page) => page.member) ?? []
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  return (
    <nav aria-label="Playlists">
      <div className="mb-1 flex items-center justify-between pr-1 pl-3">
        <h2 className="text-xs font-medium tracking-wider text-neutral-400 uppercase">Playlists</h2>
        <button type="button" onClick={() => setCreating(true)} aria-label="New playlist" title="New playlist" className="p-1 text-neutral-400 hover:text-white">
          <PlusIcon className="h-4.5 w-4.5" />
        </button>
      </div>
      {playlists.isSuccess && members.length === 0 && <p className="px-3 py-2 text-sm text-neutral-500">No playlists yet.</p>}
      <ul className="flex flex-col gap-1">
        {members.map((playlist) => (
          <NavItem key={playlist.id} to={`/playlists/${playlist.id}`} icon={<PlaylistIcon />}>
            {playlist.name}
          </NavItem>
        ))}
      </ul>
      <InfiniteScrollTrigger {...playlists} />
      {creating && (
        <PlaylistNameDialog
          title="New playlist"
          submitLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={async (name) => {
            const playlist = await createPlaylist(name)
            setCreating(false)
            void navigate(`/playlists/${playlist.id}`)
          }}
        />
      )}
    </nav>
  )
}
