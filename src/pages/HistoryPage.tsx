import { useSearchParams } from 'react-router'
import { InfiniteScrollTrigger } from '../components/InfiniteScrollTrigger'
import { QueryError } from '../components/QueryError'
import { Spinner } from '../components/Spinner'
import { Tab, Tabs } from '../components/Tabs'
import { TrackItem } from '../components/TrackItem'
import { plural, timeAgo } from '../library/format'
import { useRecentTracks, useTopTracks, type Period } from '../library/history'
import { playQueue, togglePlay } from '../player/engine'
import { PauseIcon, PlayIcon } from '../player/icons'
import { usePlayer } from '../player/store'

type View = 'recent' | 'top'

const PERIODS: [Period, string][] = [
  ['week', 'This week'],
  ['month', 'This month'],
  ['year', 'This year'],
  ['all', 'All time'],
]

const isPeriod = (value: string | null): value is Period => PERIODS.some(([period]) => period === value)

/**
 * The user's listening history: the tracks played, the most recent first, or the most played, over a period (in the
 * URL: ?period=week). Play plays the list from the top. Only the user sees it; the profile can clear it.
 */
export function HistoryPage({ view }: { view: View }) {
  const [params, setParams] = useSearchParams()
  const period: Period = isPeriod(params.get('period')) ? (params.get('period') as Period) : 'all'

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">History</h1>
      <Tabs label="History">
        <Tab to="/history/recent">Recently played</Tab>
        <Tab to="/history/top">Most played</Tab>
      </Tabs>
      {view === 'top' && (
        <div role="radiogroup" aria-label="Period" className="-mt-2 mb-6 flex flex-wrap gap-1">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={period === value}
              onClick={() => setParams(value === 'all' ? {} : { period: value }, { replace: true })}
              className="rounded-md px-3 py-1 text-sm text-neutral-400 hover:text-white aria-checked:bg-neutral-800 aria-checked:text-white"
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {view === 'recent' ? <RecentTracks /> : <TopTracks key={period} period={period} />}
    </main>
  )
}

function RecentTracks() {
  const history = useRecentTracks()
  return (
    <PlayedList
      query={history}
      origin="history:recent"
      empty="Nothing yet: the tracks you listen to show up here."
      note={(played) => `${timeAgo(played.lastPlayedAt ?? '')} · ${plural(played.playCount ?? 0, 'play')}`}
    />
  )
}

function TopTracks({ period }: { period: Period }) {
  const history = useTopTracks(period)
  return (
    <PlayedList
      query={history}
      origin={`history:top:${period}`}
      ranked
      empty={period === 'all' ? 'Nothing yet: the tracks you listen to most show up here.' : 'Nothing played in this period.'}
      note={(played) => plural(played.playCount ?? 0, 'play')}
    />
  )
}

type Played = NonNullable<ReturnType<typeof useRecentTracks>['data']>['pages'][number]['member'][number]

interface PlayedListProps {
  query: ReturnType<typeof useRecentTracks> | ReturnType<typeof useTopTracks>
  /** The origin of a queue made of this list, so Play turns into Pause while it plays. */
  origin: string
  empty: string
  note: (played: Played) => string
  /** Numbered: 1, 2, 3... */
  ranked?: boolean
}

function PlayedList({ query, origin, empty, note, ranked = false }: PlayedListProps) {
  const members = query.data?.pages.flatMap((page) => page.member) ?? []
  const tracks = members.flatMap((played) => (played.track ? [played.track] : []))
  const total = query.data?.pages[0]?.totalItems
  const isCurrent = usePlayer((state) => state.origin === origin && state.index >= 0)
  const playing = usePlayer((state) => state.playing) && isCurrent

  /** Every track of the list, loading the pages not shown yet. */
  async function allTracks() {
    let result = query
    while (result.hasNextPage && !result.isFetchNextPageError) {
      result = await result.fetchNextPage()
    }
    return (result.data?.pages.flatMap((page) => page.member) ?? members).flatMap((played) => (played.track ? [played.track] : []))
  }

  async function playFrom(index?: number) {
    playQueue(await allTracks(), { startIndex: index, origin })
  }

  if (query.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (query.isLoadingError) {
    return <QueryError error={query.error} retry={query.refetch} />
  }
  if (members.length === 0) {
    return <p className="py-12 text-center text-neutral-400">{empty}</p>
  }
  return (
    <>
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
      <ol>
        {members.map((played, index) =>
          played.track ? (
            <li key={played.track.id}>
              <TrackItem
                track={played.track}
                onPlay={() => void playFrom(tracks.indexOf(played.track!))}
                note={note(played)}
                before={ranked ? <span className="w-6 shrink-0 text-right text-sm text-neutral-500 tabular-nums">{index + 1}</span> : undefined}
              />
            </li>
          ) : null,
        )}
      </ol>
      <InfiniteScrollTrigger {...query} />
    </>
  )
}
