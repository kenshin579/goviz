import { describe, it, expect } from 'vitest'
import { nextPlayhead, BASE_PLAY_MS } from './playback'

describe('nextPlayhead', () => {
  // span = 1000, base = 4000ms => 1x plays full span in 4000ms.
  it('advances proportionally to elapsed real time at 1x', () => {
    const r = nextPlayhead(0, BASE_PLAY_MS / 2, 1, 0, 1000)
    expect(r.time).toBeCloseTo(500) // half the base time -> half the span
    expect(r.atEnd).toBe(false)
  })

  it('scales the advance by speed', () => {
    const r = nextPlayhead(0, BASE_PLAY_MS / 2, 2, 0, 1000)
    expect(r.time).toBeCloseTo(1000) // 2x -> full span in half the base time
    expect(r.atEnd).toBe(true) // reached the end
  })

  it('clamps at endTime and reports atEnd', () => {
    const r = nextPlayhead(900, BASE_PLAY_MS, 1, 0, 1000)
    expect(r.time).toBe(1000)
    expect(r.atEnd).toBe(true)
  })

  it('does not move on a zero-width trace', () => {
    const r = nextPlayhead(500, 16, 1, 500, 500)
    expect(r.time).toBe(500)
    expect(r.atEnd).toBe(true) // already at (the only) end
  })

  it('respects a custom base duration', () => {
    const r = nextPlayhead(0, 1000, 1, 0, 1000, 1000)
    expect(r.time).toBeCloseTo(1000)
    expect(r.atEnd).toBe(true)
  })
})

describe('nextPlayhead loop', () => {
  it('wraps past the end instead of clamping when loop is on', () => {
    // span 100, at 1x over base 1000ms: 150ms from t=95 lands 10 units past end.
    const r = nextPlayhead(95, 150, 1, 0, 100, 1000, true)
    expect(r.atEnd).toBe(false)
    expect(r.time).toBeCloseTo(10)
  })
  it('still clamps at the end when loop is off', () => {
    const r = nextPlayhead(95, 150, 1, 0, 100, 1000, false)
    expect(r).toEqual({ time: 100, atEnd: true })
  })
})
