import { describe, it, expect } from 'vitest'
import { placeTour, TOUR_TARGETS, POP_W, POP_H } from './guide'

const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, width, height, bottom: top + height,
})

describe('TOUR_TARGETS', () => {
  it('walks timeline → header → graph → legend (mockup order)', () => {
    expect([...TOUR_TARGETS]).toEqual(['timeline', 'header', 'graph', 'legend'])
  })
})

describe('placeTour', () => {
  it('pads the spotlight 4px around the target', () => {
    const { spot } = placeTour(rect(100, 50, 300, 120), 1200, 800)
    expect(spot).toEqual({ x: 96, y: 46, w: 308, h: 128 })
  })
  it('prefers placing the popover below the target', () => {
    const { pop } = placeTour(rect(100, 50, 300, 120), 1200, 800)
    expect(pop.y).toBe(50 + 120 + 14)
    expect(pop.x).toBe(124) // left + 24
  })
  it('flips above when below would overflow the viewport', () => {
    const { pop } = placeTour(rect(100, 500, 300, 200), 1200, 800)
    expect(pop.y).toBe(500 - POP_H - 14)
  })
  it('clamps x into the viewport', () => {
    const { pop } = placeTour(rect(1150, 50, 40, 40), 1200, 800)
    expect(pop.x).toBe(1200 - POP_W - 24)
  })
  it('falls back inside the target when neither side fits', () => {
    const { pop } = placeTour(rect(0, 10, 300, 780), 1200, 800)
    expect(pop.y).toBeGreaterThanOrEqual(12)
    expect(pop.y + POP_H).toBeLessThanOrEqual(800)
  })
})
