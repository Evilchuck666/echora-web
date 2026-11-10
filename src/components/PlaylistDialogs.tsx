import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { queryClient } from '../app/query-client'
import { plural } from '../library/format'
import { addToPlaylist, createPlaylist, MAX_NAME, usePlaylists } from '../library/playlists'
import type { Playlist } from '../library/types'
import type { PlayerTrack } from '../player/store'
import { Dialog } from './Dialog'
import { InfiniteScrollTrigger } from './InfiniteScrollTrigger'
import { Spinner } from './Spinner'
import { showToast } from './toast'

const FIELD =
  'w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:border-violet-400 focus:outline-none'
const PRIMARY = 'shrink-0 rounded-md bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-50'

/** The API's message when it refused, else a generic one. */
function reason(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

interface NameFormProps {
  initial?: string
  submitLabel: string
  /** Throws to show the error under the field. */
  onSubmit: (name: string) => Promise<void>
}

/** A playlist's name (1 to 100 characters, trimmed), and the button that uses it. */
function NameForm({ initial = '', submitLabel, onSubmit }: NameFormProps) {
  const [name, setName] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!trimmed || saving) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(trimmed)
    } catch (caught) {
      setError(reason(caught, "Couldn't save it. Try again."))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm text-neutral-300">
        Name
        <span className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_NAME}
            required
            aria-invalid={error !== null}
            aria-describedby={error ? 'playlist-name-error' : undefined}
            placeholder="My playlist"
            className={FIELD}
          />
          <button type="submit" disabled={!trimmed || saving} className={PRIMARY}>
            {submitLabel}
          </button>
        </span>
      </label>
      {error && (
        <p id="playlist-name-error" role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </form>
  )
}

interface PlaylistNameDialogProps {
  title: string
  initial?: string
  submitLabel: string
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
}

/** Names a new playlist, or renames one. */
export function PlaylistNameDialog({ title, initial, submitLabel, onSubmit, onClose }: PlaylistNameDialogProps) {
  return (
    <Dialog title={title} onClose={onClose}>
      <NameForm initial={initial} submitLabel={submitLabel} onSubmit={onSubmit} />
    </Dialog>
  )
}

interface AddToPlaylistDialogProps {
  /** What is added, as the dialog and the toast call it: a track's or an album's title. */
  name: string
  /** The tracks to add; may load them first (every track of an album). */
  tracks: () => PlayerTrack[] | Promise<PlayerTrack[]>
  onClose: () => void
}

/**
 * "Add to playlist": one of the user's playlists, the most recently changed first, or a new one named here. The
 * tracks go at the end, all at once; a toast says where they went.
 */
export function AddToPlaylistDialog({ name, tracks, onClose }: AddToPlaylistDialogProps) {
  const playlists = usePlaylists()
  const members = playlists.data?.pages.flatMap((page) => page.member) ?? []
  const [busy, setBusy] = useState(false)

  // Read the playlists again: one may have been made meanwhile, on another device.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['playlists'] })
  }, [])

  async function addTo(playlist: Playlist) {
    const ids = (await tracks()).flatMap((track) => (track.id ? [track.id] : []))
    const updated = await addToPlaylist(playlist.id!, ids)
    showToast(`${ids.length === 1 ? `“${name}”` : plural(ids.length, 'track')} added to “${updated.name}”`)
    onClose()
  }

  async function choose(playlist: Playlist) {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      await addTo(playlist)
    } catch (error) {
      showToast(reason(error, `Couldn't add “${name}” to “${playlist.name}”.`))
      setBusy(false)
    }
  }

  return (
    <Dialog title={`Add “${name}” to a playlist`} onClose={onClose}>
      <section aria-label="New playlist" className="mb-4">
        <NameForm submitLabel="Create and add" onSubmit={async (newName) => addTo(await createPlaylist(newName))} />
      </section>
      <section aria-label="Your playlists">
        <h3 className="mb-2 text-xs font-medium tracking-wider text-neutral-400 uppercase">Your playlists</h3>
        {playlists.isPending ? (
          <Spinner />
        ) : members.length === 0 ? (
          <p className="text-sm text-neutral-400">No playlists yet: name one above.</p>
        ) : (
          <>
            <ul className="flex flex-col">
              {members.map((playlist) => (
                <li key={playlist.id}>
                  <button
                    type="button"
                    onClick={() => void choose(playlist)}
                    disabled={busy}
                    className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-neutral-800 disabled:opacity-50"
                  >
                    <span className="truncate">{playlist.name}</span>
                    <span className="shrink-0 text-sm text-neutral-400">{plural(playlist.trackCount, 'track')}</span>
                  </button>
                </li>
              ))}
            </ul>
            <InfiniteScrollTrigger {...playlists} />
          </>
        )}
      </section>
    </Dialog>
  )
}
