import { describe, it, expect } from 'vitest'
import { stateAt, activeEdges } from './activeAt'
import type { Goroutine, CausalEdge } from './types'

const g: Goroutine = {
  id: 1,
  name: 'a',
  createdAt: 0,
  endedAt: 100,
  intervals: [
    { start: 0, end: 40, state: 'running', blockReason: '' },
    { start: 40, end: 100, state: 'blocked', blockReason: 'chan receive' },
  ],
}

describe('stateAt', () => {
  it('returns the state of the interval containing t', () => {
    expect(stateAt(g, 10)).toBe('running')
    expect(stateAt(g, 40)).toBe('blocked') // start-inclusive
    expect(stateAt(g, 99)).toBe('blocked')
  })
  it('returns null when t is outside every interval', () => {
    expect(stateAt(g, -1)).toBeNull()
    expect(stateAt(g, 100)).toBeNull() // end-exclusive
  })
})

describe('activeEdges', () => {
  const edges: CausalEdge[] = [
    { from: 1, to: 2, time: 50, category: 'channel' },
    { from: 2, to: 3, time: 80, category: 'mutex' },
    { from: 3, to: 1, time: 200, category: 'other' },
  ]
  it('returns edges whose time is within +/- window of t', () => {
    const a = activeEdges(edges, 55, 10) // window 10 -> [45,65]
    expect(a.map((e) => e.time)).toEqual([50])
  })
  it('includes multiple edges in range and excludes out-of-range', () => {
    const a = activeEdges(edges, 65, 20) // [45,85] -> 50 and 80
    expect(a.map((e) => e.time)).toEqual([50, 80])
  })
  it('returns empty when none are in range', () => {
    expect(activeEdges(edges, 130, 5)).toEqual([])
  })
})
