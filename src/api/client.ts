import createClient, { type Middleware } from 'openapi-fetch'
import { getAccessToken, refreshAccessToken } from '../auth/session'
import { ApiError, apiError } from './errors'
import type { paths } from './schema'

export { ApiError }

// Typed client for the Echora API. The types in schema.d.ts are generated: run `bun run api:types` when the API changes.
// JSON-LD is required for collections to include `totalItems` and the pagination links in `view`.
// The second type argument picks the JSON-LD shapes out of the generated types.
export const api = createClient<paths, 'application/ld+json'>({
  baseUrl: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/ld+json' },
})

/** Copies of the authenticated requests in flight, to send again after a refresh (a body can only be read once). */
const pendingRetries = new Map<string, Request>()

const authentication: Middleware = {
  async onRequest({ request, id }) {
    const token = await getAccessToken()
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
      pendingRetries.set(id, request.clone())
    }
    return request
  },

  // A 401 means the JWT was rejected before it expired (e.g. the server's keys changed): refresh it and retry once.
  async onResponse({ request, response, id }) {
    const retry = pendingRetries.get(id)
    pendingRetries.delete(id)
    if (response.status !== 401 || !retry) {
      return response
    }

    const rejectedToken = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
    const token = await refreshAccessToken(rejectedToken)
    if (!token) {
      return response
    }
    retry.headers.set('Authorization', `Bearer ${token}`)
    return fetch(retry)
  },

  onError({ id }) {
    pendingRetries.delete(id)
  },
}

api.use(authentication)

/** Returns the data of an openapi-fetch call, or throws an ApiError: what TanStack Query's `queryFn` expects. */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await call
  if (error !== undefined || data === undefined) {
    throw apiError(response, error)
  }
  return data
}

/** For calls answered without a body (204): resolves once it worked, or throws an ApiError like unwrap(). */
export async function unwrapEmpty(call: Promise<{ error?: unknown; response: Response }>): Promise<void> {
  const { error, response } = await call
  if (error !== undefined || !response.ok) {
    throw apiError(response, error)
  }
}

