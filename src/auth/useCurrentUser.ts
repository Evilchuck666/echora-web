import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'

/** The account this browser is signed in as. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => unwrap(api.GET('/api/me')),
  })
}
