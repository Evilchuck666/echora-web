import { describe, expect, it } from 'vitest'
import { formatDuration, plural } from './format'

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [999, '0:01'],
    [187_000, '3:07'],
    [599_400, '9:59'],
    [3_600_000, '1:00:00'],
    [3_765_000, '1:02:45'],
  ])('%i ms is %s', (milliseconds, expected) => {
    expect(formatDuration(milliseconds)).toBe(expected)
  })
})

describe('plural', () => {
  it('uses the singular for one only', () => {
    expect(plural(1, 'album')).toBe('1 album')
    expect(plural(0, 'album')).toBe('0 albums')
    expect(plural(12, 'track')).toBe('12 tracks')
  })

  it('takes an irregular plural', () => {
    expect(plural(2, 'child', 'children')).toBe('2 children')
  })
})
