import { create } from 'zustand'

// The tokens live in localStorage so that every tab shares them: when one tab refreshes them, the others pick up the new
// pair instead of presenting the spent refresh token, which would revoke the whole session (see session.ts).

const STORAGE_KEY = 'echora.session'

export interface Tokens {
  /** The JWT sent as `Authorization: Bearer`; valid for one hour. */
  token: string
  /** Single use: each refresh returns a new one and spends this one. */
  refreshToken: string
  /** Unix timestamp, in seconds. */
  refreshTokenExpiresAt: number
}

/** Body returned by POST /api/auth and POST /api/token/refresh. */
export interface TokenResponse {
  readonly token: string
  readonly refresh_token?: string
  readonly refresh_token_expiration?: number
}

export function tokensFromResponse(response: TokenResponse): Tokens {
  if (!response.refresh_token || !response.refresh_token_expiration) {
    throw new Error('The API returned no refresh token')
  }

  return {
    token: response.token,
    refreshToken: response.refresh_token,
    refreshTokenExpiresAt: response.refresh_token_expiration,
  }
}

export function readTokens(): Tokens | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return isTokens(stored) ? stored : null
  } catch {
    return null
  }
}

export function writeTokens(tokens: Tokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  useSession.setState({ signedIn: true })
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY)
  useSession.setState({ signedIn: false })
}

/** Seconds until the JWT expires, or 0 when it can't be read. Only used to refresh ahead of time: the API decides. */
export function secondsUntilExpiry(jwt: string): number {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown }
    return typeof exp === 'number' ? exp - Date.now() / 1000 : 0
  } catch {
    return 0
  }
}

function isTokens(value: unknown): value is Tokens {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { token, refreshToken, refreshTokenExpiresAt } = value as Record<string, unknown>
  return typeof token === 'string' && typeof refreshToken === 'string' && typeof refreshTokenExpiresAt === 'number'
}

/** Whether this browser holds a session. Components subscribe to it; writeTokens() and clearTokens() keep it current. */
export const useSession = create<{ signedIn: boolean }>(() => ({ signedIn: readTokens() !== null }))

// Another tab signed in or out (or refreshed): the storage event only fires in the other tabs.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    useSession.setState({ signedIn: readTokens() !== null })
  }
})
