import { describe, expect, it } from 'vitest'
import { moveInPages } from './playlists'

describe('moveInPages', () => {
  it('moves an item within the loaded pages, the pages keeping their sizes', () => {
    const pages = [['a', 'b', 'c'], ['d', 'e']]

    expect(moveInPages(pages, 4, 0)).toEqual([['e', 'a', 'b'], ['c', 'd']])
    expect(moveInPages(pages, 0, 3)).toEqual([['b', 'c', 'd'], ['a', 'e']])
    expect(moveInPages(pages, 1, 1)).toEqual(pages)
  })

  it('leaves the pages it was given as they were', () => {
    const pages = [['a', 'b'], ['c']]

    moveInPages(pages, 2, 0)

    expect(pages).toEqual([['a', 'b'], ['c']])
  })
})

describe('changes to a playlist', () => {
  it('reach the API one at a time, in the order they were made', async () => {
    const { writeTokens } = await import('../auth/tokens')
    const { calls, json, jwt, routes } = await import('../test/http')
    const { moveItem, removeItem } = await import('./playlists')
    writeTokens({ token: jwt(3600), refreshToken: 'r', refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 9999 })
    let answerMove = () => {}
    routes({
      'PATCH /api/playlist_items/i3': () => new Promise<Response>((resolve) => (answerMove = () => resolve(json({ id: 'i3', position: 1 })))),
      'DELETE /api/playlist_items/i1': () => new Response(null, { status: 204 }),
      'GET /api/playlists/p1': () => json({ id: 'p1', name: 'P', trackCount: 2, durationMs: 0 }),
      'GET /api/playlists': () => json({ member: [] }),
    })
    const sent = async () => (await calls()).filter((call) => call.method !== 'GET').map((call) => `${call.method} ${new URL(call.url).pathname}`)

    const { queryClient } = await import('../app/query-client')
    const item = (itemId: string) => ({ id: itemId, position: 0 })
    queryClient.setQueryData(['playlist-items', 'p1'], { pages: [{ member: [item('i1'), item('i2'), item('i3')] }], pageParams: [1] })
    const invalidated = () => queryClient.getQueryState(['playlist-items', 'p1'])?.isInvalidated
    const shown = () => (queryClient.getQueryData(['playlist-items', 'p1']) as { pages: { member: { id: string }[] }[] }).pages[0].member.map((i) => i.id)

    // Move, then remove at once, without waiting: positions are indexes in the API's current order.
    const move = moveItem('p1', 'i3', 2, 1)
    const remove = removeItem('p1', 'i1')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await sent()).toEqual(['PATCH /api/playlist_items/i3'])
    // Both shown at once.
    expect(shown()).toEqual(['i3', 'i2'])

    answerMove()
    await move
    // The removal is still under way: reading the items now would bring i1 back on screen.
    expect(invalidated()).toBe(false)
    await remove
    expect(await sent()).toEqual(['PATCH /api/playlist_items/i3', 'DELETE /api/playlist_items/i1'])
    // Once the last change is done, the items are read again.
    expect(invalidated()).toBe(true)
  })
})
