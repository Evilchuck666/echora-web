import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api, ApiError, unwrap } from '../api/client'
import type { components } from '../api/schema'
import { queryClient } from '../app/query-client'
import { nextPage } from './queries'

// Scans of the music library (the API's docs/decisions/0015), for administrators: one at a time, run in the
// background by the API's library worker, every night too. The latest one is read again every 2 seconds while it is
// queued or running, to show its progress; once it is done, the library on screen is read again.

export type LibraryScan = components['schemas']['LibraryScan.jsonld-library_scan.read']

const LATEST = ['library-scan']
const ALL = ['library-scans']
const POLL_MS = 2000

export const isActive = (scan: LibraryScan | null | undefined) => scan?.status === 'queued' || scan?.status === 'running'

/** The latest scan, or null when the library was never scanned. */
export function useLatestScan() {
  const latest = useQuery({
    queryKey: LATEST,
    queryFn: async () => {
      try {
        return await unwrap(api.GET('/api/library/scan'))
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      }
    },
    refetchInterval: (query) => (isActive(query.state.data) ? POLL_MS : false),
    staleTime: 0,
  })

  // A scan that just ended changed the library: whatever is cached of it is read again, and the list of scans too.
  const wasActive = useRef(false)
  const active = isActive(latest.data)
  useEffect(() => {
    if (wasActive.current && !active) {
      void queryClient.invalidateQueries({
        predicate: (query) => !['me', 'users', 'library-scan', 'history'].includes(String(query.queryKey[0])),
      })
    }
    wasActive.current = active
  }, [active])

  return latest
}

/** Every scan, the latest first: read again every 2 seconds while the latest one is queued or running. */
export function useScans() {
  return useInfiniteQuery({
    queryKey: ALL,
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/library/scans', { params: { query: { page: pageParam } } })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => nextPage(lastPage.view),
    refetchInterval: (query) => (isActive(query.state.data?.pages[0]?.member[0]) ? POLL_MS : false),
    staleTime: 0,
  })
}

/**
 * Asks for a scan: new, changed, moved and deleted files, or every file read again (`full`, e.g. to read tags a new
 * version of Echora knows). Throws an ApiError 409 while another one is queued or running.
 */
export async function startScan(full: boolean): Promise<LibraryScan> {
  const scan = await unwrap(api.POST('/api/library/scan', { body: { full } }))
  queryClient.setQueryData(LATEST, scan)
  void queryClient.invalidateQueries({ queryKey: ALL })
  return scan
}
