import { describe, it, expect } from 'vitest'
import { buildGraphModel } from './graphModel'
import type { Goroutine, CausalEdge } from './types'

const goroutines: Goroutine[] = [
  { id: 1, name: 'main.a', createdAt: 0, endedAt: 100, intervals: [] },
  { id: 2, name: '', createdAt: 0, endedAt: 100, intervals: [] },
]
const edges: CausalEdge[] = [
  { from: 1, to: 2, time: 10, category: 'channel' },
  { from: 1, to: 2, time: 20, category: 'channel' }, // duplicate pair
  { from: 2, to: 9, time: 30, category: 'mutex' }, // 9 not in visible set -> dropped
]

describe('buildGraphModel', () => {
  it('makes one node per goroutine with a display label', () => {
    const m = buildGraphModel(goroutines, edges)
    expect(m.nodes.map((n) => n.id)).toEqual([1, 2])
    expect(m.nodes[0].label).toBe('main.a')
    expect(m.nodes[1].label).toBe('g2') // empty name fallback
  })

  it('dedups links per pair and drops links to hidden goroutines', () => {
    const m = buildGraphModel(goroutines, edges)
    expect(m.links).toHaveLength(1)
    expect(m.links[0]).toMatchObject({ source: 1, target: 2, category: 'channel' })
  })

  it('handles an empty goroutine set', () => {
    const m = buildGraphModel([], edges)
    expect(m.nodes).toEqual([])
    expect(m.links).toEqual([])
  })
})
