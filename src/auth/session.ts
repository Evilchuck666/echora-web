import createClient from 'openapi-fetch'
import type { paths } from '../api/schema'
import { clearTokens, readTokens, secondsUntilExpiry, tokensFromResponse, writeTokens, type TokenResponse } from './tokens'

// Refresh tokens are single use, and presenting one that was already spent revokes the whole session. So a refresh must
// never run twice with the same token, neither in this tab (concurrent requests) nor across tabs:
// - in this tab, concurrent callers share one in-flight refresh;
// - across tabs, refreshes run inside a Web Lock, and the tokens are read again once the lock is held: if another tab
//   refreshed meanwhile, its new token is used and nothing is sent.

const REFRESH_LOCK = 'echora.token-refresh'

/** Refresh this long before the JWT expires, so requests don't race its expiry. */
const EXPIRY_MARGIN_SECONDS = 60

const baseUrl = import.meta.env.VITE_API_URL

/** Client for the public authentication endpoint; it bypasses the middleware that adds the token. */
const authApi = createClient<paths>({ baseUrl })

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Wrong username or password')
  }
}

export async function signIn(username: string, password: string): Promise<void> {
  const { data, response } = await authApi.POST('/api/auth', { body: { username, password } })
  if (response.status === 401) {
    throw new InvalidCredentialsError()
  }
  if (!data) {
    throw new Error(`Couldn't sign in (HTTP ${response.status})`)
  }
  writeTokens(tokensFromResponse(data))
}

/**
 * Forgets the session in every tab. The API has no sign-out endpoint, so the refresh token stays valid on the server
 * until it expires.
 */
export function signOut(): void {
  clearTokens()
}

/** A JWT to send, refreshed first when it is about to expire; `null` when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const tokens = readTokens()
  if (!tokens) {
    return null
  }
  if (secondsUntilExpiry(tokens.token) > EXPIRY_MARGIN_SECONDS) {
    return tokens.token
  }
  return refreshAccessToken(tokens.token)
}

let inFlightRefresh: Promise<string | null> | null = null

/**
 * Replaces `staleToken` (about to expire, or rejected with a 401) with a fresh JWT. Returns `null` when the session is
 * over (refresh token expired or revoked), after signing out.
 */
export function refreshAccessToken(staleToken: string): Promise<string | null> {
  inFlightRefresh ??= withRefreshLock(() => refreshUnlessDone(staleToken)).finally(() => {
    inFlightRefresh = null
  })
  return inFlightRefresh
}

async function refreshUnlessDone(staleToken: string): Promise<string | null> {
  // Read again inside the lock: another tab may have refreshed, or signed out, while this one waited.
  const tokens = readTokens()
  if (!tokens) {
    return null
  }
  if (tokens.token !== staleToken && secondsUntilExpiry(tokens.token) > EXPIRY_MARGIN_SECONDS) {
    return tokens.token
  }
  if (tokens.refreshTokenExpiresAt <= Date.now() / 1000) {
    signOut()
    return null
  }

  // Plain fetch: the API's OpenAPI document lists this endpoint under its route name (api_refresh_token) instead of
  // its path, so openapi-fetch can't type it.
  const response = await fetch(`${baseUrl}/api/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
  })
  if (response.status === 401) {
    // Unknown, expired or revoked (password changed, account deleted, or a spent token presented).
    signOut()
    return null
  }
  if (!response.ok) {
    throw new Error(`Couldn't refresh the session (HTTP ${response.status})`)
  }

  const refreshed = tokensFromResponse((await response.json()) as TokenResponse)
  writeTokens(refreshed)
  return refreshed.token
}

function withRefreshLock<T>(callback: () => Promise<T>): Promise<T> {
  // Web Locks need a secure context (https, or http://localhost). Without them, tabs can't coordinate: refresh anyway.
  if (!('locks' in navigator)) {
    return callback()
  }
  return navigator.locks.request(REFRESH_LOCK, callback)
}
