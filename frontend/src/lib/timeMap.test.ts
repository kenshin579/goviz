import { describe, it, expect } from 'vitest'
import { makeTimeScale } from './timeMap'

describe('makeTimeScale', () => {
  it('maps the domain start to the range start and end to end', () => {
    const s = makeTimeScale(1000, 2000, 0, 500)
    expect(s.toPixel(1000)).toBe(0)
    expect(s.toPixel(2000)).toBe(500)
    expect(s.toPixel(1500)).toBe(250)
  })

  it('inverts pixels back to time', () => {
    const s = makeTimeScale(1000, 2000, 0, 500)
    expect(s.toTime(0)).toBe(1000)
    expect(s.toTime(500)).toBe(2000)
    expect(s.toTime(250)).toBe(1500)
  })

  it('is robust to a zero-width domain (degenerate trace)', () => {
    const s = makeTimeScale(1000, 1000, 0, 500)
    expect(Number.isFinite(s.toPixel(1000))).toBe(true)
    expect(Number.isFinite(s.toTime(250))).toBe(true)
    // Documented contract: collapses to rangeStart / domainStart.
    expect(s.toPixel(9999)).toBe(0)
    expect(s.toTime(9999)).toBe(1000)
  })
})
