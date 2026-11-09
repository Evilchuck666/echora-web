import { useCallback } from 'react'
import { useNavigate } from 'react-router'

export const SEARCH_PATH = '/search'

/** The results page of a query; never called with an empty one (see useLeaveSearch). */
export function searchUrl(query: string): string {
  return `${SEARCH_PATH}?${new URLSearchParams({ q: query })}`
}

/**
 * Leaves the search when its query becomes empty: /search without a query is never a page of its own. Goes back to
 * the page the search started from, the last valid URL; when the app was opened on the search itself, there is
 * nothing of ours to go back to, so the search entry is replaced by the home page.
 */
export function useLeaveSearch(): () => void {
  const navigate = useNavigate()

  return useCallback(() => {
    // React Router numbers the history entries it made in this tab: 0 is the one the app was opened on.
    const index = (window.history.state as { idx?: unknown } | null)?.idx
    if (typeof index === 'number' && index > 0) {
      navigate(-1)
    } else {
      navigate('/', { replace: true })
    }
  }, [navigate])
}
