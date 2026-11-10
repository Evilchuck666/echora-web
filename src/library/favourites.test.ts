import { beforeEach, describe, expect, it } from 'vitest'
import { clearTokens, writeTokens } from '../auth/tokens'
import { useToast } from '../components/toast'
import { calls, jwt, routes } from '../test/http'
import { changedFavourite, setFavourite } from './favourites'

const noContent = () => new Response(null, { status: 204 })

beforeEach(() => {
  writeTokens({ token: jwt(3600), refreshToken: 'refresh', refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 86400 })
  useToast.setState({ message: null })
})

describe('setFavourite', () => {
  it('changes the heart at once, and tells the API', async () => {
    let answer = () => {}
    routes({ 'PUT /api/albums/a1/favourite': () => new Promise<Response>((resolve) => (answer = () => resolve(noContent()))) })

    const done = setFavourite('album', 'a1', true, 'Killer')

    expect(changedFavourite('album', 'a1')).toBe(true)
    await new Promise((resolve) => setTimeout(resolve))
    answer()
    await done
    expect(changedFavourite('album', 'a1')).toBe(true)
    expect((await calls()).map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual(['PUT /api/albums/a1/favourite'])
  })

  it('removes with DELETE', async () => {
    routes({ 'DELETE /api/tracks/t1/favourite': noContent })

    await setFavourite('track', 't1', false, 'Be My Lover')

    expect(changedFavourite('track', 't1')).toBe(false)
  })

  it('puts the heart back and says so when the API refuses', async () => {
    routes({ 'PUT /api/artists/r1/favourite': () => new Response('{"title":"Server error"}', { status: 500 }) })

    await setFavourite('artist', 'r1', true, 'Accept')

    expect(changedFavourite('artist', 'r1')).toBeUndefined()
    expect(useToast.getState().message).toBe("Couldn't add “Accept” to your favourites.")
  })

  it('forgets the changes on sign-out: the next account starts from what the API says', async () => {
    routes({ 'PUT /api/tracks/t2/favourite': noContent })
    await setFavourite('track', 't2', true, 'Starlight')

    clearTokens()

    expect(changedFavourite('track', 't2')).toBeUndefined()
  })
})
