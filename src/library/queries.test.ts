import { describe, expect, it } from 'vitest'
import { nextPage } from './queries'

describe('nextPage', () => {
  it('reads the page number of the next link', () => {
    expect(nextPage({ next: '/api/artists?page=2' })).toBe(2)
    expect(nextPage({ next: '/api/albums?artist=%2Fapi%2Fartists%2F1&page=7' })).toBe(7)
  })

  it('is undefined on the last page', () => {
    expect(nextPage({})).toBeUndefined()
    expect(nextPage({ next: null })).toBeUndefined()
    expect(nextPage(undefined)).toBeUndefined()
  })

  it('ignores a link without a usable page number', () => {
    expect(nextPage({ next: '/api/artists' })).toBeUndefined()
    expect(nextPage({ next: '/api/artists?page=abc' })).toBeUndefined()
    expect(nextPage({ next: '/api/artists?page=0' })).toBeUndefined()
  })
})
