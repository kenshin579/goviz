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

  it('maps lane x/width over the full span', () => {
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

describe('layoutTimelineRows lane geometry (via buildLane)', () => {
  const soloRows = (gs: any[]) => layoutTimelineRows(
    { startTime: 0, endTime: 100, goroutines: gs, edges: [] } as any,
    groupGoroutines(gs as any),
    new Set<string>(),
    { width: 200, laneHeight: 18, laneGap: 4, gutter: 0, regionRowH: 8 },
  )

  it('offsets x by the gutter and maps width over the span', () => {
    const rows = soloRows([{ id: 1, name: 'main.a', createdAt: 0, endedAt: 100, intervals: [{ start: 0, end: 50, state: 'running', blockReason: '' }] }]) as any
    const lane = rows[0]
    expect(lane.kind).toBe('lane')
    expect(lane.rects[0].x).toBe(0)
    expect(lane.rects[0].width).toBeCloseTo(100) // 50/100 * 200
  })

  it('respects gutter offset for x', () => {
    const gs = [{ id: 1, name: 'main.a', createdAt: 0, endedAt: 100, intervals: [{ start: 0, end: 50, state: 'running', blockReason: '' }] }]
    const rows = layoutTimelineRows(
      { startTime: 0, endTime: 100, goroutines: gs, edges: [] } as any,
      groupGoroutines(gs as any),
      new Set<string>(),
      { width: 200, laneHeight: 18, laneGap: 4, gutter: 50 },
    ) as any
    expect(rows[0].rects[0].x).toBe(50)
    expect(rows[0].rects[0].width).toBeCloseTo(75) // 50% of (200-50)
  })

  it('clamps tiny interval widths to >= 1px', () => {
    const gs = [{ id: 1, name: 'x', createdAt: 0, endedAt: 1_000_000, intervals: [{ start: 0, end: 1, state: 'running', blockReason: '' }] }]
    const rows = layoutTimelineRows(
      { startTime: 0, endTime: 1_000_000, goroutines: gs, edges: [] } as any,
      groupGoroutines(gs as any),
      new Set<string>(),
      { width: 1000, laneHeight: 18, laneGap: 4 },
    ) as any
    expect(rows[0].rects[0].width).toBeGreaterThanOrEqual(1)
  })

  it('grows a lane with regions and stacks the next solo lane below it', () => {
    const rows = soloRows([
      { id: 1, name: 'main.a', createdAt: 0, endedAt: 100, intervals: [{ start: 0, end: 100, state: 'running', blockReason: '' }], regions: [{ start: 0, end: 60, name: 'outer', depth: 0 }, { start: 10, end: 40, name: 'inner', depth: 1 }] },
      { id: 2, name: 'main.b', createdAt: 0, endedAt: 100, intervals: [{ start: 0, end: 100, state: 'running', blockReason: '' }] },
    ]) as any
    expect(rows[0].totalHeight).toBe(18 + 2 * 8) // 2 region rows
    expect(rows[1].y).toBe(rows[0].totalHeight + 4) // stacked by totalHeight + laneGap
    const inner = rows[0].regions.find((r: any) => r.name === 'inner')
    expect(inner.depth).toBe(1)
    expect(inner.x).toBe(20) // t=10 over span 100, width 200
  })

  it('honors topOffset for the first row y', () => {
    const rows = layoutTimelineRows(
      { startTime: 0, endTime: 100, goroutines: [{ id: 1, name: 'a', createdAt: 0, endedAt: 100, intervals: [{ start: 0, end: 100, state: 'running', blockReason: '' }] }], edges: [] } as any,
      groupGoroutines([{ id: 1, name: 'a' }] as any),
      new Set<string>(),
      { width: 200, laneHeight: 18, laneGap: 4, topOffset: 30 },
    ) as any
    expect(rows[0].y).toBe(30)
  })
})
