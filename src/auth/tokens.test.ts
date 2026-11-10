import { describe, expect, it } from 'vitest'
import { jwt } from '../test/http'
import { clearTokens, readTokens, secondsUntilExpiry, tokensFromResponse, useSession, writeTokens } from './tokens'

const tokens = { token: 'a.b.c', refreshToken: 'refresh', refreshTokenExpiresAt: 2_000_000_000 }

describe('tokens', () => {
  it('are written to and read from shared storage', () => {
    writeTokens(tokens)

    expect(readTokens()).toEqual(tokens)
    expect(useSession.getState().signedIn).toBe(true)
  })

  it('are gone after clearing', () => {
    writeTokens(tokens)
    clearTokens()

    expect(readTokens()).toBeNull()
    expect(useSession.getState().signedIn).toBe(false)
  })

  it('ignore what is not a session in storage', () => {
    localStorage.setItem('echora.session', '{not json')
    expect(readTokens()).toBeNull()

    localStorage.setItem('echora.session', JSON.stringify({ token: 'only a token' }))
    expect(readTokens()).toBeNull()
  })

  it('follow another tab signing in and out', () => {
    clearTokens()
    localStorage.setItem('echora.session', JSON.stringify(tokens))
    window.dispatchEvent(new StorageEvent('storage', { key: 'echora.session' }))
    expect(useSession.getState().signedIn).toBe(true)

    localStorage.removeItem('echora.session')
    window.dispatchEvent(new StorageEvent('storage', { key: 'echora.session' }))
    expect(useSession.getState().signedIn).toBe(false)
  })

  it('come from the body of /api/auth and /api/token/refresh', () => {
    expect(tokensFromResponse({ token: 't', refresh_token: 'r', refresh_token_expiration: 42 })).toEqual({
      token: 't',
      refreshToken: 'r',
      refreshTokenExpiresAt: 42,
    })
    expect(() => tokensFromResponse({ token: 't' })).toThrow('no refresh token')
  })
})

describe('secondsUntilExpiry', () => {
  it('reads the expiry of a JWT', () => {
    expect(secondsUntilExpiry(jwt(3600))).toBeGreaterThan(3590)
    expect(secondsUntilExpiry(jwt(-10))).toBeLessThan(0)
  })

  it('is 0 for something that is not a JWT', () => {
    expect(secondsUntilExpiry('garbage')).toBe(0)
    expect(secondsUntilExpiry('a.bm90IGpzb24.c')).toBe(0)
  })
})
