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
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ActionsMenu } from '../components/ActionsMenu'
import { Cover } from '../components/Cover'
import { Dialog } from '../components/Dialog'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { PlaylistNameDialog } from '../components/PlaylistDialogs'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { showToast } from '../components/toast'
import { ON_HOVER, TrackItem } from '../components/TrackItem'
import { formatDuration, plural } from '../library/format'
import { deletePlaylist, moveItem, removeItem, renamePlaylist, usePlaylist, usePlaylistItems } from '../library/playlists'
import type { Playlist, PlaylistItem } from '../library/types'
import { playQueue, togglePlay } from '../player/engine'
import { CloseIcon, DragHandleIcon, PauseIcon, PlayIcon } from '../player/icons'
import { usePlayer } from '../player/store'

/** Rows only move up and down. */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const screenReaderInstructions = {
  draggable: 'To move this track, press space or enter, move it with the up and down arrows, and press space or enter again to drop it, or escape to cancel.',
}

/** A playlist: its tracks in order, to play, reorder (drag a handle), remove; renamed or deleted from its menu. */
export function PlaylistPage() {
  const { id = '' } = useParams()
  const playlist = usePlaylist(id)

  if (playlist.isLoadingError) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <QueryError error={playlist.error} retry={playlist.refetch} notFound="This playlist doesn't exist, or isn't yours." />
      </main>
    )
  }

  if (playlist.isPending) {
    return (
      <main className="flex justify-center px-4 py-18">
        <Spinner />
      </main>
    )
  }

  return <PlaylistView playlist={playlist.data} />
}

function PlaylistView({ playlist }: { playlist: Playlist }) {
  const id = playlist.id!
  const items = usePlaylistItems(id)
  const members = items.data?.pages.flatMap((page) => page.member) ?? []
  const origin = `playlist:${id}`
  const isCurrent = usePlayer((state) => state.origin === origin && state.index >= 0)
  const playing = usePlayer((state) => state.playing) && isCurrent
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  /** Every item, loading the pages not shown yet. */
  async function allItems() {
    if (!items.hasNextPage) {
      return members
    }
    let result = await items.fetchNextPage()
    while (result.hasNextPage && !result.isFetchNextPageError) {
      result = await result.fetchNextPage()
    }
    return result.data?.pages.flatMap((page) => page.member) ?? members
  }

  /** Queues the playlist and plays from the given item: the first, or a random one when shuffle is on. */
  async function playFrom(index?: number) {
    const tracks = (await allItems()).flatMap((item) => (item.track ? [item.track] : []))
    playQueue(tracks, { startIndex: index, origin })
  }

  const trackCount = playlist.trackCount ?? 0
  const durationMs = playlist.durationMs ?? 0
  const facts = [plural(trackCount, 'track'), ...(durationMs > 0 ? [formatDuration(durationMs)] : [])]

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end">
        <PlaylistCover covers={playlist.covers ?? []} className="w-48 shrink-0 shadow-lg sm:w-56" />
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wider text-neutral-400 uppercase">Playlist</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight break-words sm:text-4xl">{playlist.name}</h1>
          <p className="mt-2 text-sm text-neutral-400">{facts.join(' · ')}</p>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (isCurrent ? togglePlay() : void playFrom())}
              disabled={trackCount === 0}
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 py-2 pr-5 pl-4 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <ActionsMenu
              label={`More options for ${playlist.name}`}
              actions={[
                { label: 'Rename…', onSelect: () => setRenaming(true) },
                { label: 'Delete…', onSelect: () => setDeleting(true) },
              ]}
            />
          </div>
        </div>
      </header>

      {items.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : items.isLoadingError ? (
        <QueryError error={items.error} retry={items.refetch} />
      ) : members.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">This playlist is empty: add tracks or albums from their “⋯” menu.</p>
      ) : (
        <>
          <ItemList playlist={playlist} items={members} onPlay={(index) => void playFrom(index)} />
          <InfiniteScrollTrigger {...items} />
        </>
      )}

      {renaming && (
        <PlaylistNameDialog
          title="Rename the playlist"
          initial={playlist.name}
          submitLabel="Rename"
          onClose={() => setRenaming(false)}
          onSubmit={async (name) => {
            await renamePlaylist(id, name)
            setRenaming(false)
          }}
        />
      )}
      {deleting && <DeleteDialog playlist={playlist} onClose={() => setDeleting(false)} />}
    </main>
  )
}

/** Up to four album covers in a square, or the one there is, or a placeholder. */
function PlaylistCover({ covers, className }: { covers: string[]; className: string }) {
  if (covers.length < 4) {
    return <Cover url={covers[0] ?? null} alt="" className={`rounded-lg ${className}`} />
  }
  return (
    <div aria-hidden="true" className={`grid aspect-square grid-cols-2 overflow-hidden rounded-lg ${className}`}>
      {covers.slice(0, 4).map((url) => (
        <Cover key={url} url={url} alt="" className="w-full" />
      ))}
    </div>
  )
}

interface ItemListProps {
  playlist: Playlist
  items: PlaylistItem[]
  onPlay: (index: number) => void
}

/** The items, in order: each moves by dragging its handle (or from the keyboard) and leaves with its ×. */
function ItemList({ playlist, items, onPlay }: ItemListProps) {
  const id = playlist.id!
  const sensors = useSensors(
    // A few pixels before a drag starts, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const indexOf = (itemId: UniqueIdentifier) => items.findIndex((item) => item.id === itemId)
  const title = (itemId: UniqueIdentifier) => items[indexOf(itemId)]?.track?.title ?? 'The track'
  const position = (itemId: UniqueIdentifier) => `position ${indexOf(itemId) + 1} of ${playlist.trackCount ?? items.length}`
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} is at ${position(over.id)}.` : `${title(active.id)} is outside the playlist.`),
    onDragEnd: ({ active, over }) => (over ? `${title(active.id)} dropped at ${position(over.id)}.` : `${title(active.id)} put back.`),
    onDragCancel: ({ active }) => `Moving ${title(active.id)} cancelled.`,
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      moveItem(id, String(active.id), indexOf(active.id), indexOf(over.id)).catch(() => showToast(`Couldn't move “${title(active.id)}”.`))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[vertical]}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <SortableContext items={items.map((item) => item.id!)} strategy={verticalListSortingStrategy}>
        <ol>
          {items.map((item, index) => (
            <ItemRow key={item.id} playlistId={id} item={item} onPlay={() => onPlay(index)} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function ItemRow({ playlistId, item, onPlay }: { playlistId: string; item: PlaylistItem; onPlay: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id! })
  const title = item.track?.title ?? 'Unknown track'

  if (!item.track) {
    return null
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'relative z-10 rounded-md bg-neutral-900 shadow-lg' : ''}
    >
      <TrackItem
        track={item.track}
        onPlay={onPlay}
        before={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${title}`}
            className="-ml-1 flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-500 hover:text-neutral-200 active:cursor-grabbing"
          >
            <DragHandleIcon className="h-4 w-4" />
          </button>
        }
        after={
          <button
            type="button"
            onClick={() => removeItem(playlistId, item.id!).catch(() => showToast(`Couldn't remove “${title}”.`))}
            aria-label={`Remove ${title} from the playlist`}
            title="Remove from the playlist"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-white ${ON_HOVER}`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        }
      />
    </li>
  )
}

/** "Delete this playlist?", answered here: the browser's confirm() isn't used. */
function DeleteDialog({ playlist, onClose }: { playlist: Playlist; onClose: () => void }) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)

  async function confirm() {
    setDeleting(true)
    try {
      await deletePlaylist(playlist.id!)
      showToast(`“${playlist.name}” deleted`)
      void navigate('/', { replace: true })
    } catch {
      showToast(`Couldn't delete “${playlist.name}”.`)
      setDeleting(false)
    }
  }

  return (
    <Dialog title={`Delete “${playlist.name}”?`} onClose={onClose}>
      <p className="text-neutral-300">The playlist goes away; its tracks stay in the library.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-neutral-700 px-4 py-2 hover:border-neutral-500">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={deleting}
          className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </Dialog>
  )
}
