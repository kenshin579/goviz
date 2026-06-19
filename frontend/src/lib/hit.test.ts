import { describe, it, expect } from 'vitest'
import { hitTimeline, nodeAtPoint, distToSegment } from './hit'
import type { Lane } from './timelineLayout'

const lanes: Lane[] = [
  {
    goroutineId: 1,
    label: 'a',
    y: 0,
    height: 18,
    rects: [
      { x: 0, width: 40, state: 'running', color: '#0a0', blockReason: '' },
      { x: 40, width: 60, state: 'blocked', color: '#a00', blockReason: 'chan receive' },
    ],
  },
  { goroutineId: 2, label: 'b', y: 21, height: 18, rects: [{ x: 0, width: 100, state: 'running', color: '#0a0', blockReason: '' }] },
]

describe('hitTimeline', () => {
  const stride = 21 // LANE_H 18 + LANE_GAP 3
  it('finds the lane and the rect under the point', () => {
    const h = hitTimeline(lanes, 50, 5, stride, 18)
    expect(h?.lane.goroutineId).toBe(1)
    expect(h?.rect?.blockReason).toBe('chan receive')
  })
  it('returns null in the inter-lane gap', () => {
    expect(hitTimeline(lanes, 50, 19, stride, 18)).toBeNull() // y 18..21 is gap
  })
  it('returns null below all lanes', () => {
    expect(hitTimeline(lanes, 50, 200, stride, 18)).toBeNull()
  })
  it('returns the lane with a null rect when x is past its intervals', () => {
    const h = hitTimeline(lanes, 500, 26, stride, 18) // lane 2, x beyond width
    expect(h?.lane.goroutineId).toBe(2)
    expect(h?.rect).toBeNull()
  })
})

describe('nodeAtPoint', () => {
  const nodes = [
    { id: 1, label: 'a', x: 100, y: 100 },
    { id: 2, label: 'b', x: 200, y: 100 },
  ]
  it('finds a node within the radius', () => {
    expect(nodeAtPoint(nodes, 104, 103, 10)?.id).toBe(1)
  })
  it('returns undefined when no node is close', () => {
    expect(nodeAtPoint(nodes, 150, 150, 10)).toBeUndefined()
  })
})

describe('distToSegment', () => {
  it('is the perpendicular distance to a horizontal segment', () => {
    expect(distToSegment(50, 10, 0, 0, 100, 0)).toBeCloseTo(10)
  })
  it('clamps to the nearest endpoint past the segment', () => {
    expect(distToSegment(-30, 0, 0, 0, 100, 0)).toBeCloseTo(30)
  })
})
