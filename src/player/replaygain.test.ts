import { describe, expect, it } from 'vitest'
import { gainFactor } from './replaygain'

const db = (gain: number) => 10 ** (gain / 20)

describe('gainFactor', () => {
  const tags = { replayGain: { trackGain: -6, trackPeak: 0.9, albumGain: -3, albumPeak: 0.95 } }

  it('is 1 when leveling is off, or the track has no tags', () => {
    expect(gainFactor(tags, 'off', false)).toBe(1)
    expect(gainFactor({}, 'track', false)).toBe(1)
    expect(gainFactor(undefined, 'auto', true)).toBe(1)
  })

  it('uses the track gain track by track, and the album gain for a whole album in auto', () => {
    expect(gainFactor(tags, 'track', true)).toBeCloseTo(db(-6))
    expect(gainFactor(tags, 'auto', false)).toBeCloseTo(db(-6))
    expect(gainFactor(tags, 'auto', true)).toBeCloseTo(db(-3))
  })

  it('falls back on the other gain when the file has only one', () => {
    expect(gainFactor({ replayGain: { albumGain: -4 } }, 'track', false)).toBeCloseTo(db(-4))
    expect(gainFactor({ replayGain: { trackGain: -5 } }, 'auto', true)).toBeCloseTo(db(-5))
  })

  it('never goes above 1, nor above 1/peak', () => {
    // Quiet tracks would need more than the element's volume can give: they play as they are.
    expect(gainFactor({ replayGain: { trackGain: 4, trackPeak: 0.5 } }, 'track', false)).toBe(1)
    // A gain that would still clip.
    expect(gainFactor({ replayGain: { trackGain: -1, trackPeak: 1.25 } }, 'track', false)).toBeCloseTo(0.8)
  })
})
