import { describe, it, expect } from 'vitest'
import { layoutTimelineRows, hitGroupHeader, rowsHeight, GROUP_HEADER_H } from './timelineLayout'
import { groupGoroutines } from './grouping'

describe('layoutTimelineRows', () => {
  const mk = (id: number, name: string) => ({
    id, name, createdAt: 0, endedAt: 100,
    intervals: [{ start: 0, end: 100, state: 'running', blockReason: '' }],
  })
  const summary = (gs: any[]) => ({ startTime: 0, endTime: 100, goroutines: gs, edges: [] }) as any
  const opts = { width: 200, laneHeight: 18, laneGap: 2 }

  it('emits a header row plus member lane rows for an expanded group', () => {
    const gs = [mk(1, 'main.w'), mk(2, 'main.w')] as any[]
    const rows = layoutTimelineRows(summary(gs), groupGoroutines(gs), new Set<string>(), opts)
    expect(rows.map((r) => r.kind)).toEqual(['header', 'lane', 'lane'])
    const header = rows[0] as Extract<typeof rows[number], { kind: 'header' }>
    expect(header.name).toBe('main.w')
    expect(header.count).toBe(2)
    expect(header.collapsed).toBe(false)
    expect(header.y).toBe(0)
    expect(header.height).toBe(GROUP_HEADER_H)
    expect((rows[1] as any).y).toBe(GROUP_HEADER_H + opts.laneGap)
  })

  it('emits only the header row for a collapsed group', () => {
    const gs = [mk(1, 'main.w'), mk(2, 'main.w')] as any[]
    const rows = layoutTimelineRows(summary(gs), groupGoroutines(gs), new Set(['main.w']), opts)
    expect(rows.map((r) => r.kind)).toEqual(['header'])
    expect((rows[0] as any).collapsed).toBe(true)
  })

  it('emits a bare lane row (no header) for a solo goroutine', () => {
    const gs = [mk(1, 'main.solo')] as any[]
    const rows = layoutTimelineRows(summary(gs), groupGoroutines(gs), new Set<string>(), opts)
    expect(rows.map((r) => r.kind)).toEqual(['lane'])
    expect((rows[0] as any).label).toBe('main.solo')
    expect((rows[0] as any).y).toBe(0)
  })

  it('maps lane geometry like layoutTimeline (x/width over the span)', () => {
    const gs = [mk(1, 'main.solo')] as any[]
    const rows = layoutTimelineRows(summary(gs), groupGoroutines(gs), new Set<string>(), opts)
    const lane = rows[0] as any
    expect(lane.rects[0].x).toBe(0)
    expect(lane.rects[0].width).toBe(200) // full span
  })
})

describe('rowsHeight', () => {
  it('returns 0 for no rows', () => {
    expect(rowsHeight([])).toBe(0)
  })
  it('uses totalHeight when the last row is a lane', () => {
    const rows = [{ kind: 'lane', y: 10, totalHeight: 18 }] as any
    expect(rowsHeight(rows)).toBe(28)
  })
  it('uses height when the last row is a (collapsed) header', () => {
    const rows = [{ kind: 'header', y: 30, height: 16 }] as any
    expect(rowsHeight(rows)).toBe(46)
  })
})

describe('hitGroupHeader', () => {
  const rows = [
    { kind: 'header', key: 'main.w', name: 'main.w', count: 2, collapsed: false, y: 0, height: 16 },
    { kind: 'lane', goroutineId: 1, y: 18, totalHeight: 18 },
  ] as any

  it('returns the header key when y is within a header row', () => {
    expect(hitGroupHeader(rows, 8)).toBe('main.w')
  })
  it('returns null when y is over a lane row', () => {
    expect(hitGroupHeader(rows, 25)).toBeNull()
  })
  it('returns null when y is past all rows', () => {
    expect(hitGroupHeader(rows, 999)).toBeNull()
  })
})
