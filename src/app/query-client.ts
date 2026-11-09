import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { useSession } from '../auth/tokens'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The library only changes when the server scans it, so data stays fresh for a while.
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      // Client errors (4xx) won't fix themselves; network and server errors get two more tries.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
})

// After signing out (in this tab or another), drop everything cached, so the next account starts clean.
useSession.subscribe((session, previous) => {
  if (previous.signedIn && !session.signedIn) {
    queryClient.clear()
  }
})
