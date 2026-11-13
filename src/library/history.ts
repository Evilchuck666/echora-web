import { useInfiniteQuery } from '@tanstack/react-query'
import { api, unwrap, unwrapEmpty } from '../api/client'
import { queryClient } from '../app/query-client'
import { nextPage } from './queries'

// The listening history of the user signed in (the API's docs/decisions/0016): only theirs. The player reports the
// plays (player/plays.ts); these read it back, each track once with how many times and when it was last played.

export type Period = 'week' | 'month' | 'year' | 'all'

/** The tracks played, the most recently played first. */
export function useRecentTracks() {
  return useInfiniteQuery({
    queryKey: ['history', 'recent'],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/me/recent-tracks', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

/** The tracks played most in the period (the last 7, 30 or 365 days, or ever), the most played first. */
export function useTopTracks(period: Period) {
  return useInfiniteQuery({
    queryKey: ['history', 'top', period],
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/me/top-tracks', { params: { query: { page: pageParam, period } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
  })
}

/** Forgets every play of the user. */
export async function clearHistory(): Promise<void> {
  await unwrapEmpty(api.DELETE('/api/me/history'))
  await queryClient.invalidateQueries({ queryKey: ['history'] })
}
