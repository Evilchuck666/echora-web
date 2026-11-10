import { describe, expect, it } from 'vitest'
import { searchUrl } from './search'

describe('searchUrl', () => {
  it('encodes the query', () => {
    expect(searchUrl('accept')).toBe('/search?q=accept')
    expect(searchUrl('balls to the wall')).toBe('/search?q=balls+to+the+wall')
    expect(searchUrl('mötley & co')).toBe('/search?q=m%C3%B6tley+%26+co')
  })
})
