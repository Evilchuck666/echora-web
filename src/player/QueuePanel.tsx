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
import { useShallow } from 'zustand/react/shallow'
import { Cover } from '../components/Cover'
import { formatDuration, plural } from '../library/format'
import { jumpTo, moveInQueue, removeFromQueue } from './engine'
import { CloseIcon, DragHandleIcon } from './icons'
import { PlayerPanel } from './PlayerPanel'
import { selectCurrentTrack, selectUpcoming, usePlayer, type PlayerTrack, type QueueEntry } from './store'

export const QUEUE_PANEL_ID = 'queue-panel'

/** Rows only move up and down. */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const screenReaderInstructions = {
  draggable: 'To move this track, press space or enter, move it with the up and down arrows, and press space or enter again to drop it, or escape to cancel.',
}

/**
 * What is playing and what comes next. A track plays when clicked, leaves the queue with its × and moves by dragging
 * its handle (or from the keyboard, see the instructions above). The tracks already played aren't listed, but stay
 * in the queue for Previous.
 */
export function QueuePanel({ onClose, docked }: { onClose: () => void; docked?: boolean }) {
  const current = usePlayer(selectCurrentTrack)
  const upcoming = usePlayer(useShallow(selectUpcoming))
  const index = usePlayer((state) => state.index)
  const repeatAll = usePlayer((state) => state.repeat === 'all' && state.queue.length > 1)
  const sensors = useSensors(
    // A few pixels before a drag starts, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const title = (id: UniqueIdentifier) => upcoming.find((entry) => entry.key === id)?.track.title ?? 'The track'
  const position = (id: UniqueIdentifier) => `position ${upcoming.findIndex((entry) => entry.key === id) + 1} of ${upcoming.length}`
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} is at ${position(over.id)}.` : `${title(active.id)} is outside the queue.`),
    onDragEnd: ({ active, over }) => (over ? `${title(active.id)} dropped at ${position(over.id)}.` : `${title(active.id)} put back.`),
    onDragCancel: ({ active }) => `Moving ${title(active.id)} cancelled.`,
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      // Positions in the panel start after the current track.
      moveInQueue(String(active.id), index + 1 + upcoming.findIndex((entry) => entry.key === over.id))
    }
  }

  return (
    <PlayerPanel id={QUEUE_PANEL_ID} label="Queue" title="Queue" subtitle={summary(upcoming)} onClose={onClose} docked={docked}>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {current && (
          <section aria-label="Now playing" className="mb-4">
            <h3 className="px-2 pb-2 text-xs font-medium tracking-wider text-neutral-400 uppercase">Now playing</h3>
            <div className="flex items-center gap-3 px-2">
              <TrackSummary track={current} current />
            </div>
          </section>
        )}
        <section aria-label="Next up">
          <h3 className="px-2 pb-2 text-xs font-medium tracking-wider text-neutral-400 uppercase">Next up</h3>
          {upcoming.length === 0 ? (
            <p className="px-2 py-4 text-sm text-neutral-400">
              {repeatAll ? 'Nothing more: the queue then starts again.' : 'Nothing more: the music stops after this track.'}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[vertical]}
              onDragEnd={onDragEnd}
              accessibility={{ announcements, screenReaderInstructions }}
            >
              <SortableContext items={upcoming.map((entry) => entry.key)} strategy={verticalListSortingStrategy}>
                <ol>
                  {upcoming.map((entry) => (
                    <QueueRow key={entry.key} entry={entry} />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>
    </PlayerPanel>
  )
}

/** "5 tracks to come · 18:32" (the length only when every track's is known). */
function summary(upcoming: QueueEntry[]): string {
  const facts = [`${plural(upcoming.length, 'track')} to come`]
  if (upcoming.length > 0 && upcoming.every((entry) => typeof entry.track.durationMs === 'number')) {
    facts.push(formatDuration(upcoming.reduce((sum, entry) => sum + (entry.track.durationMs ?? 0), 0)))
  }
  return facts.join(' · ')
}

function QueueRow({ entry }: { entry: QueueEntry }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.key })
  const title = entry.track.title ?? 'Unknown track'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group flex items-center gap-1 rounded-md py-1 pr-1 hover:bg-neutral-800/60 ${isDragging ? 'relative z-10 bg-neutral-800 shadow-lg' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${title}`}
        className="flex h-10 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-500 hover:text-neutral-200 active:cursor-grabbing"
      >
        <DragHandleIcon className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => jumpTo(entry.key)} aria-label={`Play ${title}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <TrackSummary track={entry.track} />
      </button>
      <button
        type="button"
        onClick={() => removeFromQueue(entry.key)}
        aria-label={`Remove ${title} from the queue`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-700 hover:text-white"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </li>
  )
}

/** Cover, title, artist and length of a track in the queue. */
function TrackSummary({ track, current = false }: { track: PlayerTrack; current?: boolean }) {
  return (
    <>
      <Cover url={track.album?.coverUrl} alt="" className="w-10 shrink-0 rounded" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${current ? 'text-violet-300' : ''}`}>{track.title}</span>
        <span className="block truncate text-sm text-neutral-400">{track.artist?.name}</span>
      </span>
      <span className="shrink-0 text-sm text-neutral-400 tabular-nums">
        {typeof track.durationMs === 'number' ? formatDuration(track.durationMs) : ''}
      </span>
    </>
  )
}
