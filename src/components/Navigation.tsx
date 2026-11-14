import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { createPlaylist, movePlaylist, usePlaylists } from '../library/playlists'
import type { Playlist } from '../library/types'
import { AlbumsIcon, ArtistsIcon, RecentIcon, DragHandleIcon, HeartIcon, HistoryIcon, PlaylistIcon, PlusIcon, TracksIcon } from '../player/icons'
import { showToast } from './toast'
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
          <NavItem to="/" end icon={<RecentIcon />}>
            Recently added
          </NavItem>
          <NavItem to="/artists" end icon={<ArtistsIcon />}>
            Artists
          </NavItem>
          <NavItem to="/albums" end icon={<AlbumsIcon />}>
            Albums
          </NavItem>
          <NavItem to="/tracks" end icon={<TracksIcon />}>
            Tracks
          </NavItem>
          <NavItem to="/favourites" icon={<HeartIcon />}>
            Favourites
          </NavItem>
          <NavItem to="/history" icon={<HistoryIcon />}>
            History
          </NavItem>
        </ul>
      </nav>
      <Playlists />
    </div>
  )
}

/** Rows only move up and down. */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const screenReaderInstructions = {
  draggable: 'To move this playlist, press space or enter, move it with the up and down arrows, and press space or enter again to drop it, or escape to cancel.',
}

/**
 * The user's playlists, in their own order (a new one comes first), and a button to make one (which then opens).
 * Each moves by dragging its handle, or from the keyboard; the order is kept by the API, the same on every device.
 */
function Playlists() {
  const playlists = usePlaylists()
  const members = playlists.data?.pages.flatMap((page) => page.member) ?? []
  const total = playlists.data?.pages[0]?.totalItems ?? members.length
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const sensors = useSensors(
    // A few pixels before a drag starts, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const indexOf = (id: UniqueIdentifier) => members.findIndex((playlist) => playlist.id === id)
  const name = (id: UniqueIdentifier) => members[indexOf(id)]?.name ?? 'The playlist'
  const position = (id: UniqueIdentifier) => `position ${indexOf(id) + 1} of ${total}`
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} is at ${position(over.id)}.` : `${name(active.id)} is outside the playlists.`),
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} dropped at ${position(over.id)}.` : `${name(active.id)} put back.`),
    onDragCancel: ({ active }) => `Moving ${name(active.id)} cancelled.`,
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      movePlaylist(String(active.id), indexOf(active.id), indexOf(over.id)).catch(() => showToast(`Couldn't move “${name(active.id)}”.`))
    }
  }

  return (
    <nav aria-label="Playlists">
      <div className="mb-1 flex items-center justify-between pr-1 pl-3">
        <h2 className="text-xs font-medium tracking-wider text-neutral-400 uppercase">Playlists</h2>
        <button type="button" onClick={() => setCreating(true)} aria-label="New playlist" title="New playlist" className="p-1 text-neutral-400 hover:text-white">
          <PlusIcon className="h-4.5 w-4.5" />
        </button>
      </div>
      {playlists.isSuccess && members.length === 0 && <p className="px-3 py-2 text-sm text-neutral-500">No playlists yet.</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[vertical]}
        onDragEnd={onDragEnd}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        <SortableContext items={members.map((playlist) => playlist.id!)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {members.map((playlist) => (
              <PlaylistRow key={playlist.id} playlist={playlist} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
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

/** A playlist's link, and the handle to move it (shown on hover or focus, always on touch screens). */
function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: playlist.id! })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group flex items-center rounded-md ${isDragging ? 'relative z-10 bg-neutral-900 shadow-lg' : ''}`}
    >
      <NavLink to={`/playlists/${playlist.id}`} className={`${LINK} min-w-0 flex-1`}>
        <span className="shrink-0 text-neutral-400">
          <PlaylistIcon />
        </span>
        <span className="truncate">{playlist.name}</span>
      </NavLink>
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${playlist.name}`}
        className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-500 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-neutral-200 active:cursor-grabbing pointer-coarse:opacity-100"
      >
        <DragHandleIcon className="h-4 w-4" />
      </button>
    </li>
  )
}
