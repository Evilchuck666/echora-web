import createClient from 'openapi-fetch'
import { ApiError, apiError } from '../api/errors'
import type { paths } from '../api/schema'
import { clearTokens, readTokens, secondsUntilExpiry, tokensFromResponse, writeTokens, type TokenResponse } from './tokens'

// Refresh tokens are single use, and presenting one that was already spent revokes the whole session. So a refresh must
// never run twice with the same token, neither in this tab (concurrent requests) nor across tabs:
// - in this tab, concurrent callers share one in-flight refresh;
// - across tabs, refreshes run inside a Web Lock, and the tokens are read again once the lock is held: if another tab
//   refreshed meanwhile, its new token is used and nothing is sent.
// Signing out takes the same lock, so it always invalidates the current refresh token, never one a refresh just spent.
// So does changing the password, which spends every refresh token of the account and returns a new pair.

const SESSION_LOCK = 'echora.session'

/** Refresh this long before the JWT expires, so requests don't race its expiry. */
const EXPIRY_MARGIN_SECONDS = 60

const baseUrl = import.meta.env.VITE_API_URL

/** Client for the public authentication endpoints; it bypasses the middleware that adds the token. */
const authApi = createClient<paths>({ baseUrl })

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Wrong email, username or password')
  }
}

/** Signs in with the email or the username of an account. */
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
 * Whether the server still has no account, so its first visitor creates the administrator (GET /api/setup, public).
 * False when it can't tell (an older API without the endpoint, or unreachable): the sign-in form is shown then.
 */
export async function setupRequired(): Promise<boolean> {
  try {
    const { data } = await authApi.GET('/api/setup')
    return (data as { required?: boolean } | undefined)?.required === true
  } catch {
    return false
  }
}

export interface SetupDetails {
  email: string
  name: string
  password: string
}

/**
 * Creates the first account of the server, its administrator, and signs in with it. Throws an ApiError: 409 when the
 * server has an account already, 422 with the fields refused.
 */
export async function setUpServer(details: SetupDetails): Promise<void> {
  const { data, error, response } = await authApi.POST('/api/setup', { body: details })
  if (!response.ok || !data) {
    throw apiError(response, error)
  }
  writeTokens(tokensFromResponse(data as unknown as TokenResponse))
}

/**
 * Changes the password of the account signed in. The API signs the account out of every device and answers with a new
 * pair for this one, kept for every tab. Under the session lock: a refresh running meanwhile, here or in another tab,
 * would present a refresh token the change has just revoked, and sign the user out. Throws an ApiError (422 with the
 * fields refused, e.g. a wrong current password).
 */
export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return withSessionLock(async () => {
    const tokens = readTokens()
    // The middleware can't be used: it would wait for the lock this function holds to refresh the token.
    const token = !tokens
      ? null
      : secondsUntilExpiry(tokens.token) > EXPIRY_MARGIN_SECONDS
        ? tokens.token
        : await refreshUnlessDone(tokens.token)
    if (!token) {
      throw new ApiError(401, 'Signed out')
    }
    const { data, error, response } = await authApi.POST('/api/me/password', {
      body: { currentPassword, newPassword },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok || !data) {
      throw apiError(response, error)
    }
    writeTokens(tokensFromResponse(data as unknown as TokenResponse))
    // As after a refresh: the other tabs see the new pair before one of them can take the lock (see below).
    await new Promise((resolve) => setTimeout(resolve))
  })
}

/**
 * Ends the session in every tab and invalidates its refresh token on the server. The JWT already issued stays valid
 * until it expires (one hour at most), but this browser no longer has it.
 */
export function signOut(): Promise<void> {
  return withSessionLock(async () => {
    const tokens = readTokens()
    clearTokens()
    if (!tokens) {
      return
    }
    try {
      await authApi.POST('/api/logout', { body: { refresh_token: tokens.refreshToken } })
    } catch {
      // Unreachable server: signed out here anyway, and the refresh token expires on its own.
    }
  })
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
  inFlightRefresh ??= withSessionLock(() => refreshUnlessDone(staleToken)).finally(() => {
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
  // The session is over: clear it here only (signOut() would wait for the lock this tab already holds).
  if (tokens.refreshTokenExpiresAt <= Date.now() / 1000) {
    clearTokens()
    return null
  }

  const { data, response } = await authApi.POST('/api/token/refresh', {
    body: { refresh_token: tokens.refreshToken },
  })
  if (response.status === 401) {
    // Unknown, expired or revoked (signed out, password changed, account deleted, or a spent token presented).
    clearTokens()
    return null
  }
  if (!data) {
    throw new Error(`Couldn't refresh the session (HTTP ${response.status})`)
  }

  const refreshed = tokensFromResponse(data)
  writeTokens(refreshed)
  // Firefox passes a tab's localStorage writes on to the other tabs when the current task ends, but releases a Web
  // Lock as soon as its callback settles, earlier: a tab waiting for the lock could get it first, still read the
  // spent refresh token and present it again. Ending this task before releasing the lock sends the write first.
  await new Promise((resolve) => setTimeout(resolve))
  return refreshed.token
}

function withSessionLock<T>(callback: () => Promise<T>): Promise<T> {
  // Web Locks need a secure context (https, or http://localhost). Without them, tabs can't coordinate: refresh anyway.
  if (!navigator.locks) {
    return callback()
  }
  return navigator.locks.request(SESSION_LOCK, callback)
}
