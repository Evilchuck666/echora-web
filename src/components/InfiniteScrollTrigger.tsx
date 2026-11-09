import { useEffect, useRef } from 'react'
import { Spinner } from './Spinner'

interface InfiniteScrollTriggerProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage: () => unknown
}

/**
 * Placed after a list: loads the next page when it comes near the viewport. After a failed page it shows a retry
 * button instead of trying again on its own.
 */
export function InfiniteScrollTrigger({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: InfiniteScrollTriggerProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  const canLoad = hasNextPage && !isFetchingNextPage && !isFetchNextPageError

  useEffect(() => {
    const element = sentinel.current
    if (!element || !canLoad) {
      return
    }
    // Start loading a little before the end of the list is visible.
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && fetchNextPage(), {
      rootMargin: '600px',
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [canLoad, fetchNextPage])

  if (!hasNextPage) {
    return null
  }

  return (
    <div ref={sentinel} className="flex justify-center py-6">
      {isFetchNextPageError ? (
        <button type="button" onClick={() => fetchNextPage()} className="text-sm text-violet-400 hover:underline">
          Couldn't load more. Try again
        </button>
      ) : (
        <Spinner label="Loading more" />
      )}
    </div>
  )
}
