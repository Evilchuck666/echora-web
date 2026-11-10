import { describe, expect, it } from 'vitest'
import { writeTokens } from '../auth/tokens'
import { calls, json, jwt, routes } from '../test/http'
import { api, ApiError, unwrap } from './client'

const inAMonth = () => Math.floor(Date.now() / 1000) + 30 * 86400

describe('the authentication middleware', () => {
  it('sends the JWT, and asks for JSON-LD', async () => {
    const token = jwt(3600)
    writeTokens({ token, refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })
    routes({ 'GET /api/me': () => json({ username: 'listener' }) })

    await api.GET('/api/me')

    const [call] = await calls()
    expect(call.headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(call.headers.get('Accept')).toBe('application/ld+json')
  })

  it('sends no Authorization header when signed out', async () => {
    routes({ 'GET /api/me': () => json({ code: 401, message: 'JWT Token not found' }, 401) })

    const { response } = await api.GET('/api/me')

    expect(response.status).toBe(401)
    expect((await calls())[0].headers.has('Authorization')).toBe(false)
  })

  it('refreshes a rejected JWT and sends the request again, once', async () => {
    const rejected = jwt(3600, 'rejected')
    const fresh = jwt(3600, 'fresh')
    writeTokens({ token: rejected, refreshToken: 'refresh-0', refreshTokenExpiresAt: inAMonth() })
    routes({
      'GET /api/me': (request) =>
        request.headers.get('Authorization') === `Bearer ${fresh}`
          ? json({ username: 'listener' })
          : json({ code: 401, message: 'Invalid JWT Token' }, 401),
      'POST /api/token/refresh': () => json({ token: fresh, refresh_token: 'refresh-1', refresh_token_expiration: inAMonth() }),
    })

    const { data } = await api.GET('/api/me')

    expect(data).toEqual({ username: 'listener' })
    expect((await calls()).map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'GET /api/me',
      'POST /api/token/refresh',
      'GET /api/me',
    ])
  })

  it('gives the 401 back when the session is over', async () => {
    writeTokens({ token: jwt(3600), refreshToken: 'revoked', refreshTokenExpiresAt: inAMonth() })
    routes({
      'GET /api/me': () => json({ code: 401, message: 'Invalid JWT Token' }, 401),
      'POST /api/token/refresh': () => json({ code: 401, message: 'JWT Refresh Token Not Found' }, 401),
    })

    const { response } = await api.GET('/api/me')

    expect(response.status).toBe(401)
    expect(await calls()).toHaveLength(2)
  })
})

describe('unwrap', () => {
  it('returns the data', async () => {
    routes({ 'GET /api/me': () => json({ username: 'listener' }) })

    expect(await unwrap(api.GET('/api/me'))).toEqual({ username: 'listener' })
  })

  it.each([
    ['a JSON-LD error', { title: 'An error occurred', detail: 'Not Found' }, 404, 'Not Found'],
    ['an authenticator error', { code: 401, message: 'JWT Token not found' }, 401, 'JWT Token not found'],
    ['an error without message', {}, 500, 'Request failed (HTTP 500)'],
  ])('throws an ApiError with the message of %s', async (_, body, status, message) => {
    routes({ 'GET /api/me': () => json(body, status) })

    const error = await unwrap(api.GET('/api/me')).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status, message })
  })
})
