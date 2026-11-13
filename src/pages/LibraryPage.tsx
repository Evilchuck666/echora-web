import { useState } from 'react'
import { useCurrentUser } from '../account/accounts'
import { formErrors } from '../components/form-errors'
import { FormError, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/forms'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { formatDateTime, plural, timeAgo } from '../library/format'
import { isActive, startScan, useLatestScan, useScans, type LibraryScan } from '../library/scans'
import { NotFoundPage } from './NotFoundPage'

const PHASES: Record<NonNullable<LibraryScan['phase']>, string> = {
  listing: 'Finding the files',
  files: 'Reading the files',
  covers: 'Album covers',
  artist_images: 'Artist images',
}
const PHASE_ORDER = Object.keys(PHASES)
const PHASE_UNITS: Record<NonNullable<LibraryScan['phase']>, string> = { listing: 'file', files: 'file', covers: 'album', artist_images: 'artist' }

const TRIGGERS: Record<NonNullable<LibraryScan['trigger']>, string> = { api: 'From the app', console: 'From the console', schedule: 'Nightly' }

/**
 * The music library, for administrators: scan it now (new, changed, moved and deleted files, or every file again),
 * follow the scan as it runs, read its report, and the scans before (the nightly ones too). Anyone else gets the 404
 * page, as the API answers them.
 */
export function LibraryPage() {
  const me = useCurrentUser()

  if (me.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (!me.data?.admin) {
    return <NotFoundPage />
  }
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
      <p className="mt-1 text-sm text-neutral-400">The music folder is scanned every night. Scan it now to see new music at once.</p>
      <LatestScan />
      <EarlierScans />
    </main>
  )
}

function LatestScan() {
  const latest = useLatestScan()
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const scan = latest.data
  const busy = asking || isActive(scan)

  async function scanNow(full: boolean) {
    setAsking(true)
    setError(null)
    try {
      await startScan(full)
    } catch (caught) {
      // 409: another scan was asked for meanwhile (another administrator, or the nightly one); it shows below.
      setError(formErrors(caught, [], "Couldn't start the scan. Try again.").form)
      void latest.refetch()
    } finally {
      setAsking(false)
    }
  }

  return (
    <section aria-label="Latest scan" className="mt-6 rounded-lg border border-neutral-800 p-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void scanNow(false)} disabled={busy} className={PRIMARY_BUTTON}>
          Scan now
        </button>
        <button type="button" onClick={() => void scanNow(true)} disabled={busy} className={SECONDARY_BUTTON}>
          Full scan
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        A full scan reads every file again, even unchanged ones: after an update of Echora that reads more tags (such as
        ReplayGain). It takes longer.
      </p>
      <div className="mt-2">
        <FormError message={error} />
      </div>

      <div className="mt-5 border-t border-neutral-800 pt-4">
        {latest.isPending ? (
          <Spinner />
        ) : latest.isLoadingError ? (
          <QueryError error={latest.error} retry={latest.refetch} />
        ) : !scan ? (
          <p className="text-neutral-400">The library has never been scanned.</p>
        ) : (
          <ScanDetails scan={scan} />
        )}
      </div>
    </section>
  )
}

function ScanDetails({ scan }: { scan: LibraryScan }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">{headline(scan)}</h2>
        <p className="text-sm text-neutral-400">{when(scan)}</p>
      </div>
      {scan.status === 'running' && <Progress scan={scan} />}
      {scan.status === 'failed' && scan.error && (
        <p role="alert" className="text-sm text-red-400">
          {scan.error}
        </p>
      )}
      {scan.status === 'finished' && <Report scan={scan} />}
    </div>
  )
}

/** Where a running scan is: its phase among the four, and how far into it. */
function Progress({ scan }: { scan: LibraryScan }) {
  const phase = scan.phase ?? 'listing'
  const done = scan.phaseDone ?? 0
  const total = scan.phaseTotal ?? 0
  const step = PHASE_ORDER.indexOf(phase) + 1
  const label = `${PHASES[phase]} (step ${step} of ${PHASE_ORDER.length})`

  return (
    <div>
      <p className="mb-2 text-sm text-neutral-300">
        {label}
        {total > 0 && (
          <span className="text-neutral-400">
            {' · '}
            {done} of {plural(total, PHASE_UNITS[phase])}
          </span>
        )}
      </p>
      {/* Indeterminate while the files are being listed: their number isn't known yet. */}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total || undefined}
        aria-valuenow={total ? done : undefined}
        className="h-2 overflow-hidden rounded-full bg-neutral-800"
      >
        <div
          className={`h-full rounded-full bg-violet-500 transition-[width] ${total ? '' : 'w-1/3 animate-pulse'}`}
          style={total ? { width: `${Math.min(100, (done / total) * 100)}%` } : undefined}
        />
      </div>
    </div>
  )
}

/** What a finished scan changed, the files it couldn't read, and why artist images stopped, if they did. */
function Report({ scan }: { scan: LibraryScan }) {
  const counts: [string, number | null | undefined][] = [
    ['Added', scan.added],
    ['Moved', scan.moved],
    ['Updated', scan.updated],
    ['Removed', scan.removed],
    ['Unchanged', scan.unchanged],
    ['Unreadable', scan.failed],
    ['Covers', (scan.coversUpdated ?? 0) + (scan.coversDownloaded ?? 0)],
    ['Artist images', (scan.artistImagesUpdated ?? 0) + (scan.artistImagesDownloaded ?? 0)],
  ]
  const failures = Object.entries(scan.failures ?? {})

  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        {counts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-neutral-400">{label}</dt>
            <dd className="text-lg tabular-nums">{value ?? 0}</dd>
          </div>
        ))}
      </dl>
      {failures.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-300">Files that couldn't be read</h3>
          <ul className="max-h-60 overflow-y-auto rounded-md bg-neutral-900 p-2 text-sm">
            {failures.map(([path, reason]) => (
              <li key={path} className="py-1">
                <span className="break-all text-neutral-200">{path}</span>
                <span className="block text-neutral-400">{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {scan.theAudioDbFailure && (
        <p className="text-sm text-amber-300">
          Artist images and missing covers stopped: {scan.theAudioDbFailure}. The rest waits for the next scan.
        </p>
      )}
    </>
  )
}

function EarlierScans() {
  const scans = useScans()
  const members = scans.data?.pages.flatMap((page) => page.member) ?? []

  return (
    <section aria-label="Scans" className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">Scans</h2>
      {scans.isPending ? (
        <Spinner />
      ) : scans.isLoadingError ? (
        <QueryError error={scans.error} retry={scans.refetch} />
      ) : members.length === 0 ? (
        <p className="text-neutral-400">None yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-800">
            {members.map((scan) => (
              <li key={scan.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                <span>
                  <span className="text-neutral-200">{formatDateTime(scan.requestedAt ?? '')}</span>
                  <span className="text-neutral-500">
                    {' · '}
                    {TRIGGERS[scan.trigger ?? 'api']}
                    {scan.full ? ' · full' : ''}
                  </span>
                </span>
                <span className={scan.status === 'failed' ? 'text-red-400' : 'text-neutral-400'}>{summary(scan)}</span>
              </li>
            ))}
          </ul>
          <InfiniteScrollTrigger {...scans} />
        </>
      )}
    </section>
  )
}

function headline(scan: LibraryScan): string {
  const kind = scan.full ? 'Full scan' : 'Scan'
  switch (scan.status) {
    case 'queued':
      return `${kind} waiting to start`
    case 'running':
      return `${kind} running`
    case 'failed':
      return `${kind} failed`
    default:
      return `${kind} finished`
  }
}

/** "Nightly · finished 2 hours ago · took 3 min 05 s", "From the app · started just now". */
function when(scan: LibraryScan): string {
  const by = TRIGGERS[scan.trigger ?? 'api']
  if (scan.status === 'finished' || scan.status === 'failed') {
    const took = scan.startedAt && scan.finishedAt ? ` · took ${duration(Date.parse(scan.finishedAt) - Date.parse(scan.startedAt))}` : ''
    return `${by} · ${scan.status} ${timeAgo(scan.finishedAt ?? scan.requestedAt ?? '')}${took}`
  }
  if (scan.status === 'running' && scan.startedAt) {
    return `${by} · started ${timeAgo(scan.startedAt)}`
  }
  return `${by} · asked ${timeAgo(scan.requestedAt ?? '')}`
}

/** "12 s", "3 min 05 s", "1 h 02 min". */
function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) {
    return `${seconds} s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`
  }
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

/** "3 added · 1 removed", "No changes", "Running", or why it failed. */
function summary(scan: LibraryScan): string {
  if (scan.status === 'queued') return 'Waiting'
  if (scan.status === 'running') return 'Running'
  if (scan.status === 'failed') return scan.error ? `Failed: ${scan.error}` : 'Failed'
  const changes = (
    [
      [scan.added, 'added'],
      [scan.moved, 'moved'],
      [scan.updated, 'updated'],
      [scan.removed, 'removed'],
      [scan.failed, 'unreadable'],
    ] as const
  ).flatMap(([count, label]) => (count ? [`${count} ${label}`] : []))
  return changes.length > 0 ? changes.join(' · ') : 'No changes'
}
