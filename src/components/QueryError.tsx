import { ApiError } from '../api/client'

interface QueryErrorProps {
  error: Error
  retry: () => unknown
  /** Shown instead of the API's message when it answers 404. */
  notFound?: string
}

/**
 * What went wrong with a query's first load, with a way to try again. Once data is on screen, a failed refetch or
 * next page keeps it there instead (see InfiniteScrollTrigger): check `isLoadingError`, not `isError`.
 */
export function QueryError({ error, retry, notFound }: QueryErrorProps) {
  if (notFound && error instanceof ApiError && error.status === 404) {
    return <p className="py-12 text-center text-neutral-400">{notFound}</p>
  }

  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-neutral-300">
        {error instanceof ApiError ? error.message : "Couldn't reach the server. Is the Echora API running?"}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-500"
      >
        Try again
      </button>
    </div>
  )
}
