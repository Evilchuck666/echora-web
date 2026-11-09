import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The library only changes when the server scans it, so data stays fresh for a while.
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})
