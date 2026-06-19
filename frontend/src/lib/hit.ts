import type { Lane, LayoutRect } from './timelineLayout'

export interface TimelineHit {
  lane: Lane
  rect: LayoutRect | null
}

// hitTimeline finds the lane (and the interval rect, if any) under a point in
// timeline canvas coordinates. Returns null when the point is in the gap
// between lanes or below the last lane.
export function hitTimeline(
  lanes: Lane[],
  x: number,
  y: number,
  stride: number,
  laneHeight: number,
): TimelineHit | null {
  if (y < 0) return null
  const idx = Math.floor(y / stride)
  if (idx < 0 || idx >= lanes.length) return null
  const lane = lanes[idx]
  if (y - lane.y > laneHeight) return null // in the inter-lane gap
  const rect = lane.rects.find((r) => x >= r.x && x < r.x + r.width) ?? null
  return { lane, rect }
}

// nodeAtPoint returns the first node whose center is within radius of the point.
export function nodeAtPoint<T extends { x?: number; y?: number }>(
  nodes: T[],
  px: number,
  py: number,
  radius: number,
): T | undefined {
  return nodes.find((n) => n.x != null && n.y != null && Math.hypot(n.x - px, n.y - py) <= radius)
}

// distToSegment is the shortest distance from point (px,py) to segment a-b,
// clamped to the segment endpoints. Used for graph edge hover hit-testing.
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
