import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calls, json, jwt, routes } from '../test/http'
import { installLocks } from '../test/locks'
import { getAccessToken, InvalidCredentialsError, refreshAccessToken, signIn, signOut } from './session'
import { readTokens, writeTokens } from './tokens'

const inAMonth = () => Math.floor(Date.now() / 1000) + 30 * 86400

/** A refresh endpoint that hands out "fresh-1", "fresh-2"... and remembers the refresh tokens it was sent. */
function refreshEndpoint(spent: string[] = []) {
  let issued = 0
  return {
    spent,
    handler: async (request: Request) => {
      const { refresh_token } = (await request.json()) as { refresh_token: string }
      if (spent.includes(refresh_token)) {
        return json({ code: 401, message: 'JWT Refresh Token Not Found' }, 401)
      }
      spent.push(refresh_token)
      issued++
      return json({ token: jwt(3600, `fresh-${issued}`), refresh_token: `refresh-${issued}`, refresh_token_expiration: inAMonth() })
    },
  }
}

describe('signIn', () => {
  it('stores the tokens', async () => {
    routes({ 'POST /api/auth': () => json({ token: 'jwt', refresh_token: 'refresh', refresh_token_expiration: 99 }) })

    await signIn('listener', 'secret')

    expect(readTokens()).toEqual({ token: 'jwt', refreshToken: 'refresh', refreshTokenExpiresAt: 99 })
    expect(JSON.parse((await calls())[0].body)).toEqual({ username: 'listener', password: 'secret' })
  })

  it('tells wrong credentials apart', async () => {
    routes({ 'POST /api/auth': () => json({ code: 401, message: 'Invalid credentials.' }, 401) })

    await expect(signIn('listener', 'wrong')).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(readTokens()).toBeNull()
  })
})

describe('getAccessToken', () => {
  it('is null when signed out', async () => {
    expect(await getAccessToken()).toBeNull()
  })

  it('returns a JWT that is still valid without asking the API', async () => {
    const token = jwt(3600)
    writeTokens({ token, refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })

    expect(await getAccessToken()).toBe(token)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refreshes a JWT that expires within a minute', async () => {
    const endpoint = refreshEndpoint()
    routes({ 'POST /api/token/refresh': endpoint.handler })
    writeTokens({ token: jwt(30), refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })

    const token = await getAccessToken()

    expect(token).toBe(readTokens()?.token)
    expect(readTokens()?.refreshToken).toBe('refresh-1')
    expect(endpoint.spent).toEqual(['refresh-0'])
  })
})

describe('refreshAccessToken', () => {
  it('sends one refresh for concurrent callers in a tab', async () => {
    const endpoint = refreshEndpoint()
    routes({ 'POST /api/token/refresh': endpoint.handler })
    const stale = jwt(-1)
    writeTokens({ token: stale, refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })

    const tokens = await Promise.all([refreshAccessToken(stale), refreshAccessToken(stale), refreshAccessToken(stale)])

    expect(new Set(tokens).size).toBe(1)
    expect(endpoint.spent).toEqual(['refresh-0'])
  })

  it('signs out when the refresh token was revoked', async () => {
    routes({ 'POST /api/token/refresh': () => json({ code: 401, message: 'JWT Refresh Token Not Found' }, 401) })
    const stale = jwt(-1)
    writeTokens({ token: stale, refreshToken: 'revoked', refreshTokenExpiresAt: inAMonth() })

    expect(await refreshAccessToken(stale)).toBeNull()
    expect(readTokens()).toBeNull()
  })

  it('signs out without asking when the refresh token has expired', async () => {
    const stale = jwt(-1)
    writeTokens({ token: stale, refreshToken: 'old', refreshTokenExpiresAt: Math.floor(Date.now() / 1000) - 1 })

    expect(await refreshAccessToken(stale)).toBeNull()
    expect(readTokens()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the tokens when the API fails for another reason', async () => {
    routes({ 'POST /api/token/refresh': () => json({ title: 'Oops' }, 503) })
    const stale = jwt(-1)
    writeTokens({ token: stale, refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })

    await expect(refreshAccessToken(stale)).rejects.toThrow('HTTP 503')
    expect(readTokens()?.refreshToken).toBe('refresh-0')
  })
})

describe('across tabs', () => {
  let uninstall: () => void

  beforeEach(() => {
    uninstall = installLocks()
  })

  afterEach(() => uninstall())

  it('uses the token another tab refreshed while this one waited for the lock, instead of spending the old one', async () => {
    const endpoint = refreshEndpoint()
    routes({ 'POST /api/token/refresh': endpoint.handler })
    const stale = jwt(-1)
    writeTokens({ token: stale, refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })

    // The other tab takes the lock first and refreshes.
    let release!: () => void
    let holding!: () => void
    const otherTabHoldsTheLock = new Promise<void>((resolve) => (holding = resolve))
    const otherTab = navigator.locks.request('echora.session', async () => {
      holding()
      await new Promise<void>((resolve) => (release = resolve))
      writeTokens({ token: jwt(3600, 'other-tab'), refreshToken: 'refresh-other', refreshTokenExpiresAt: inAMonth() })
    })
    await otherTabHoldsTheLock
    const thisTab = refreshAccessToken(stale)
    release()
    await otherTab

    expect(await thisTab).toBe(readTokens()?.token)
    expect(readTokens()?.refreshToken).toBe('refresh-other')
    expect(endpoint.spent).toEqual([])
  })

  it('signs out with the refresh token a refresh in progress gets, not the one it spends', async () => {
    const endpoint = refreshEndpoint()
    const loggedOut: string[] = []
    routes({
      'POST /api/token/refresh': endpoint.handler,
      'POST /api/logout': async (request) => {
        loggedOut.push(((await request.json()) as { refresh_token: string }).refresh_token)
        return json({ code: 200, message: 'The supplied refresh_token has been invalidated.' })
      },
    })
    const stale = jwt(-1)
    writeTokens({ token: stale, refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })

    const refreshing = refreshAccessToken(stale)
    const signingOut = signOut()
    await Promise.all([refreshing, signingOut])

    expect(loggedOut).toEqual(['refresh-1'])
    expect(readTokens()).toBeNull()
  })
})

describe('signOut', () => {
  it('invalidates the refresh token on the server and forgets the session', async () => {
    routes({ 'POST /api/logout': () => json({ code: 200, message: 'ok' }) })
    writeTokens({ token: jwt(3600), refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })

    await signOut()

    const [call] = await calls()
    expect(JSON.parse(call.body)).toEqual({ refresh_token: 'refresh-0' })
    expect(call.headers.has('Authorization')).toBe(false)
    expect(readTokens()).toBeNull()
  })

  it('forgets the session even when the server is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    writeTokens({ token: jwt(3600), refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })

    await signOut()

    expect(readTokens()).toBeNull()
  })
})
